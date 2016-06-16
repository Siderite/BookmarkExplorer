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
				self.api.onCommand(function () {
					self.execute.apply(self, arguments);
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
		openSettings : function (url) {
			var self = this;
			/*var settingsUrl = self.api.getExtensionUrl('settings.html');
			self.api.selectOrNew(settingsUrl);*/
			self.api.openOptions();
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
			var manageUrl = self.api.getExtensionUrl('manage.html');
			var ownUrls = [manageUrl, self.api.getExtensionUrl('deleted.html')];
			self.api.getTabsByUrl(manageUrl).then(function (tabs) {
				var tab = tabs[0];
				if (!tab)
					return;
				if (ownUrls.includes(currentTab.url)) {
					self.api.sendMessage(tab.id, "current");
					return;
				}
				self.getInfo(currentTab.url).then(function (data) {
					self.api.sendMessage(tab.id, data);
				});
			});
		},
		refreshIconAndMenu : function (currentTab) {
			var self = this;
			var manageUrl = self.api.getExtensionUrl('manage.html');
			self.api.getSettings().then(function (settings) {
				self.getInfo(currentTab.url).then(function (data) {
					if (settings.manageContext) {
						self.api.createMenuItem('manage', 'Manage bookmark folder');
					} else {
						self.api.removeMenuItem('manage');
					}
					self.api.setIcon(currentTab.id, data ? 'icon.png' : 'icon-gray.png');
					if (data && data.prev && settings.prevNextContext) {
						self.api.createMenuItem('prevBookmark', 'Navigate to previous bookmark (Ctrl-Shift-K)');
					} else {
						self.api.removeMenuItem('prevBookmark');
					}
					if (data && data.next && settings.prevNextContext) {
						self.api.createMenuItem('nextBookmark', 'Navigate to next bookmark (Ctrl-Shift-L)');
					} else {
						self.api.removeMenuItem('nextBookmark');
					}
					if (settings.readLaterContext) {
						self.api.createMenuItem('readLater', 'Read link later');
					} else {
						self.api.removeMenuItem('readLater');
					}
				});
			});
		},
		addReadLaterBookmark : function (bm) {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.api.getSettings().then(function (settings) {
					self.api.getBookmarksBar().then(function (bar) {
						self.api.getBookmarksByTitle(settings.readLaterFolderName).then(function (bms) {
							var rl = bms.filter(function (itm) {
									return itm.parentId == bar.id;
								})[0];
							if (!rl) {
								self.api.createBookmarks({
									parentId : bar.id,
									title : settings.readLaterFolderName
								}).then(function () {
									self.addReadLaterBookmark(bm).then(resolve);
								});
								return;
							}
							self.api.getBookmarksByUrl(bm.url, 3, rl).then(function (existing) {
								self.api.removeBookmarksById(existing.map(function (itm) {
										return itm.id;
									})).then(function () {
									bm.parentId = rl.id;
									self.api.createBookmarks(bm).then(resolve);
								});
							});
						});
					});
				});
			});
		},
		readLater : function (url) {
			var self = this;
			var data = {
				url : url,
				title : null
			};
			self.api.newTab(url, true).then(function (tab) {
				var tm = null;
				var eh = null;
				var f = function (timeout) {
					if (tm)
						clearTimeout(tm);
					tm = setTimeout(function () {
							self.addReadLaterBookmark({
								url : data.url,
								title : data.title
							}).then(function () {
								if (eh)
									eh.remove();
								setTimeout(function() {
									self.api.closeTab(tab.id);
								},100);
							});
						}, timeout);
				};
				eh = self.api.onUpdatedTab(function (tabId, changeInfo, updatedTab) {
						if (tab.id == tabId && changeInfo && (changeInfo.url || changeInfo.title || changeInfo.favIconUrl)) {
							var timeout;
							if (changeInfo.url)
								timeout = 6000;
							if (changeInfo.title)
								timeout = 3000;
							if (changeInfo.favIconUrl)
								timeout = 1000;
							data.title = updatedTab.title;
							data.url = updatedTab.url;
							f(timeout);
						}
					});
				f(10000);
			});
		},
		execute : function (command, info) {
			var self = this;
			self.api.getCurrentTab().then(function (tab) {
				switch (command) {
				case 'manage':
					self.openManage(tab.url);
					return;
				case 'settings':
					self.openSettings();
					return;
				case 'readLater':
					if (!info)
						return;
					if (info.linkUrl) {
						self.readLater(info.linkUrl);
						return;
					}
					if (info.pageUrl && confirm('No link selected. Do you want me to bookmark the whole page?')) {
						self.addReadLaterBookmark({url:tab.url,title:tab.title});
					}
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

						function max(str, size) {
							if (!str)
								return '';
							if (str.length <= size - 1)
								return str;
							return str.substr(0, size) + '\u2026';
						}

						function setResultOrNotify(r, itm) {
							if (result) {
								result.notifications.push('Using the one in "' + max(result.folder.title, 20) + '"@' + (result.index + 1));
								result.notifications.push('"' + max(r.current.title, 50) + '" in "' + max(r.folder.title, 20) + '" (' + max(r.current.url, 50) + ') is a duplicate!');
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