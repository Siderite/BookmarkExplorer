(function () {

	var global = this;

	function BookmarkExplorer(api, noInitialRefresh) {
		if (!api || typeof(api) != "object")
			throw ('BookmarkExplorer needs an ApiWrapper instance as the first constructor parameter');
		this.api = api;
		this.init(noInitialRefresh);
	}

	BookmarkExplorer.prototype = {
		init : function (noInitialRefresh) {
			var self = this;
			var refresh = self.refresh.bind(self);
			if (self.api.onUpdatedTab) {
				self.api.onUpdatedTab(function (tabId, changeInfo, tab) {
					refresh();
					if (changeInfo && changeInfo.status == 'complete') {
						self.getInfo(tab.url).then(function (data) {
							if (data && data.current && tab.url == data.current.url) {
								var notify = self.api.notify.bind(self.api);
								data.notifications.forEach(notify);
							}
						});
					}
				});
			}

			if (self.api.onCreatedTab) {
				self.api.onCreatedTab(refresh);
			}
			if (self.api.onRemovedTab) {
				self.api.onRemovedTab(refresh);
			}
			if (self.api.onActivatedTab) {
				self.api.onActivatedTab(refresh);
			}

			if (self.api.onCreatedBookmark) {
				self.api.onCreatedBookmark(refresh);
			}
			if (self.api.onRemovedBookmark) {
				self.api.onRemovedBookmark(refresh);
			}
			if (self.api.onChangedBookmark) {
				self.api.onChangedBookmark(refresh);
			}
			if (self.api.onMovedBookmark) {
				self.api.onMovedBookmark(refresh);
			}
			if (self.api.onChildrenReorderedBookmark) {
				self.api.onChildrenReorderedBookmark(refresh);
			}
			if (self.api.onImportEndedBookmark) {
				self.api.onImportEndedBookmark(refresh);
			}

			if (self.api.onCommand) {
				self.api.onCommand(function (command) {
					self.execute(command);
				});
			}
			if (!noInitialRefresh) {
				refresh();
			}
		},
		dispose : function () {
			if (!this.api)
				return;
			this.api.dispose();
			this.api = null;
		},
		openManage : function (url) {
			var self = this;
			var manageUrl = self.api.getExtensionUrl('manage.html');
			self.getInfo(url).then(function (data) {
				self.api.selectOrNew(manageUrl).then(function (tab) {
					self.api.sendMessage(tab.id, data);
				});
			});
		},
		openDeleted : function (url) {
			var self = this;
			var deletedUrl = self.api.getExtensionUrl('deleted.html');
			self.api.selectOrNew(deletedUrl);
		},
		refresh : function () {
			var self = this;
			self.api.getCurrentTab().then(function (tab) {
				if (tab.url) {
					self.refreshIconAndMenu(tab);
					self.refreshManage(tab);
				}
			});
		},
		refreshManage : function (currentTab) {
			var self = this;
			var ownUrls = [self.api.getExtensionUrl('manage.html'),self.api.getExtensionUrl('deleted.html')];
			if (ownUrls.includes(currentTab.url))
				return;
			self.api.getTabsByUrl(manageUrl).then(function (tabs) {
				var tab = tabs[0];
				if (!tab)
					return;
				self.getInfo(currentTab.url).then(function (data) {
					self.api.sendMessage(tab.id, data);
				});
			});
		},
		refreshIconAndMenu : function (currentTab) {
			var self = this;
			var manageUrl = self.api.getExtensionUrl('manage.html');
			self.getInfo(currentTab.url).then(function (data) {
				self.api.createMenuItem('manage', 'Manage bookmark folder');
				self.api.setIcon(currentTab.id, data ? 'icon.png' : 'icon-gray.png');
				if (data && data.prev) {
					self.api.createMenuItem('prevBookmark', 'Navigate to previous bookmark (Ctrl-Shift-K)');
				} else {
					self.api.removeMenuItem('prevBookmark');
				}
				if (data && data.next) {
					self.api.createMenuItem('nextBookmark', 'Navigate to next bookmark (Ctrl-Shift-L)');
				} else {
					self.api.removeMenuItem('nextBookmark');
				}
			});
		},
		execute : function (command) {
			var self = this;
			self.api.getCurrentTab().then(function (tab) {
				switch (command) {
					case 'manage':
						self.openManage(tab.url);
						return;
				}
				self.getInfo(tab.url).then(function (data) {
					switch (command) {
					case 'prevBookmark':
						if (!data || !data.prev) {
							self.api.getLastTabBookmarkedUrl(tab.id).then(function (url) {
								self.getInfo(url).then(function (data) {
									if (!data || !data.prev)
										return;
									if (confirm('Page not bookmarked. Continue from last bookmarked page opened in this tab?')) {
										self.api.setUrl(tab.id, data.prev.url);
									}
								});
							});
						} else {
							self.api.setUrl(tab.id, data.prev.url);
						}
						break;
					case 'nextBookmark':
						if (!data || !data.next) {
							self.api.getLastTabBookmarkedUrl(tab.id).then(function (url) {
								self.getInfo(url).then(function (data) {
									if (!data || !data.next)
										return;
									if (confirm('Page not bookmarked. Continue from last bookmarked page opened in this tab?')) {
										self.api.setUrl(tab.id, data.next.url);
									}
								});
							});
						} else {
							self.api.setUrl(tab.id, data.next.url);
						}
						break;
					}
				});
			});
		},
		getInfo : function (url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					function walk(tree, path) {
						var result = null;

						function setResultOrNotify(r, itm) {
							if (result) {
								result.notifications.push(r.current.title + ' in ' + itm.title + ' (' + r.current.url + ') is a duplicate bookmark! Using the one in ' + result.folder.title + '@' + (result.index + 1));
							} else {
								result = r;
							}
						}

						if (tree.title) {
							if (path) {
								path += ' -> ' + tree.title;
							} else {
								path = tree.title;
							}
						}
						var arr = tree.children || tree;
						arr.forEach(function (itm, idx) {
							if (itm.children) {
								var r = walk(itm, path);
								if (r)
									setResultOrNotify(r, itm);
							}
							if (ApiWrapper.sameUrls(itm.url, url) >= 2) {
								var prev = null;
								for (var i = idx - 1; i >= 0; i--) {
									if (arr[i].url) {
										prev = arr[i];
										break;
									}
								}
								var next = null;
								for (var i = idx + 1; i < arr.length; i++) {
									if (arr[i].url) {
										next = arr[i];
										break;
									}
								}
								setResultOrNotify({
									folder : tree,
									prev : prev,
									current : itm,
									next : next,
									index : idx,
									path : path,
									notifications : []
								}, itm);
							}
						});
						return result;
					}
					self.api.getTree().then(function (tree) {
						resolve(walk(tree));
					});
				});
			return promise;
		}
	};

	global.BookmarkExplorer = BookmarkExplorer;
})();