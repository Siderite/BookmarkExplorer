(function () {

	var global = this;

	function BookmarkExplorer(api, noInitialRefresh) {
		if (!api || typeof(api) != "object")
			throw ('BookmarkExplorer needs an ApiWrapper instance as the first constructor parameter');
		this.api = api;
		this.init(noInitialRefresh);
	}

	BookmarkExplorer.preloadedUrls={};

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
				var bookmarksToStore=[];
				var removeBookmarksThrottled=ApiWrapper.throttle(function() {
					self.api.addDeletedBookmarks(bookmarksToStore).then(function() {
						bookmarksToStore.splice(0,10000);
						refresh();
					});
				});
				self.api.onRemovedBookmark(function(id,data) {
					self.api.getSettings().then(function(settings) {
						if (settings.storeAllDeletedBookmarks) {
							if (data&&data.node) {
								var bookmark=data.node;
								bookmark.index=data.index;
								bookmark.parentId=data.parentId;
								(function() {
									var f=function(bm) {
										if (bm.url) {
											bookmarksToStore.push(bm);
										} else if (bm.children&&bm.children.length) {
											bm.children.forEach(f);
										}
									};
									f(bookmark);
								})();
								removeBookmarksThrottled();
							}
						} else {
							refresh();
						}
					});
				});
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
			var ownUrls = [manageUrl, self.api.getExtensionUrl('deleted.html'), self.api.getExtensionUrl('settings.html'), self.api.getOptionsUrl()];
			self.api.getTabsByUrl(manageUrl).then(function (tabs) {
				var tab = tabs[0];
				if (!tab)
					return;
				if (ownUrls.includes(currentTab.url)||currentTab.url.startsWith('chrome:')) {
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
					self.api.removeMenuItem('readLinkLater');
					self.api.removeMenuItem('readPageLater');
					if (settings.readLaterContext) {
						self.api.createMenuItem({id:'readLinkLater', title:'Read link later',contexts:["link"]});
						if (settings.enableBookmarkPage) {
							self.api.createMenuItem({id:'readPageLater', title:'Read page later',contexts:["page"/*, "frame", "selection", "editable", "image", "video", "audio"*/]});
						}
						var n={};
						(settings.readLaterFolderName||'Read Later').split(/,/).forEach(function(name) {
							if (name) n[name]=true;
						});
						var names=Object.keys(n);
						if (names.length>1) {
							names.forEach(function(name) {
								self.api.createMenuItem({id:'readLinkLater '+name, title:name,parentId:'readLinkLater',contexts:["link"]});
								self.api.createMenuItem({id:'readPageLater '+name, title:name,parentId:'readPageLater',contexts:["page", "frame", "selection", "editable", "image", "video", "audio"]});
							});
						}
					}
					if (settings.showCurrentIndex && data) {
						self.api.setBadge(currentTab.id,data.index+1);
						self.api.setTitle(currentTab.id,data.path+' : '+(data.index+1)+'/'+data.length);
					} else {
						self.api.setBadge(currentTab.id,'');
						self.api.setTitle('Siderite\'s Bookmark Explorer');
					}
					if (settings.preloadNext && data && data.next) {
						self.preload(data.next.url);
					}
				});
			});
		},
		addReadLaterBookmark : function (bm,folderName) {
			var self = this;
			return new Promise(function (resolve, reject) {
					self.api.getBookmarksBar().then(function (bar) {
						self.api.getBookmarksByTitle(folderName).then(function (bms) {
							var rl = bms.filter(function (itm) {
									return itm.parentId == bar.id;
								})[0];
							if (!rl) {
								self.api.createBookmarks({
									parentId : bar.id,
									title : folderName
								}).then(function () {
									self.addReadLaterBookmark(bm,folderName).then(resolve);
								});
								return;
							}
							self.api.getBookmarksByUrl(bm.url, 3, rl).then(function (existing) {
								if (existing&&existing.length) {
									self.api.notify('URL already added to the Read Later list');
									resolve(existing);
								} else {
									bm.parentId = rl.id;
									self.api.createBookmarks(bm).then(resolve);
								}
							});
						});
					});
			});
		},
		readLater : function (url,folderName) {
			var self = this;
			var data = {
				url : url,
				title : null
			};
			self.api.newTab(url, true).then(function (tab) {
				self.api.getSettings().then(function (settings) {
					var tm = null;
					var eh = null;
					var f = function (timeout) {
						if (tm)
							clearTimeout(tm);
						tm = setTimeout(function () {
								self.addReadLaterBookmark({
									url : data.url,
									title : data.title
								},folderName).then(function () {
									if (eh)
										eh.remove();
									setTimeout(function () {
										self.api.closeTab(tab.id);
									}, 0.05 * settings.readLaterPageTimeout);
								});
							}, timeout);
					};
					eh = self.api.onUpdatedTab(function (tabId, changeInfo, updatedTab) {
							if (tab.id == tabId && changeInfo && (changeInfo.url || changeInfo.title || changeInfo.favIconUrl)) {
								var timeout;
								if (changeInfo.url)
									timeout = 0.6 * settings.readLaterPageTimeout;
								if (changeInfo.title)
									timeout = 0.3 * settings.readLaterPageTimeout;
								if (changeInfo.favIconUrl)
									timeout = 0.1 * settings.readLaterPageTimeout;
								data.title = updatedTab.title;
								data.url = updatedTab.url;
								f(timeout);
							}
						});
					f(0.6 * settings.readLaterPageTimeout);
				});
			});
		},
		execute : function (command, info) {
			var self = this;
			self.api.getCurrentTab().then(function (tab) {
				if (command.startsWith('readLinkLater')||command.startsWith('readPageLater')) {
					if (!info)
						return;
					var folderName=command.substr(13/*length of command*/).trim()||'Read Later';
					if (info.linkUrl) {
						self.readLater(info.linkUrl,folderName);
						return;
					}
					self.api.getSettings().then(function (settings) {
						if (info.pageUrl && (!settings.confirmBookmarkPage||confirm('No link selected. Do you want me to bookmark the current page?'))) {
							self.addReadLaterBookmark({
								url : tab.url,
								title : tab.title
							},folderName);
						}
					});
					return;
				}
				switch (command) {
				case 'manage':
					self.openManage(tab.url);
					return;
				case 'settings':
					self.openSettings();
					return;
				}
				self.getInfo(tab.url).then(function (data) {
					switch (command) {
					case 'prevBookmark':
						if (!data || !data.prev) {
							self.api.getLastTabBookmarkedUrl(tab.id).then(function (url) {
								self.getInfo(url).then(function (data) {
									if (!data) {
										self.api.notify('Page not bookmarked');
										return;
									}
									if (!data.prev) {
										self.api.notify('Reached the start of the bookmark folder');
										return;
									}
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
									if (!data) {
										self.api.notify('Page not bookmarked');
										return;
									}
									if (!data.next) {
										self.api.notify('Reached the end of the bookmark folder');
										return;
									}
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
									length : arr.length,
									path : path,
									notifications : []
								}, itm);
							}
						});
						return result;
					}
					self.api.getTree().then(function (tree) {
						var info=walk(tree);
						resolve(info);
					});
				});
			return promise;
		},
		preloadFrameId:'ifrPreload',
		preloadLinkId:'lnkPreload',
		preload: function(url) {
			var self=this;
			var time=BookmarkExplorer.preloadedUrls[url];
			var now=(new Date()).getTime();
			BookmarkExplorer.preloadedUrls[url]=now;
			if (time&&now-time<86400000) return;
			var fr=document.getElementById(self.preloadFrameId);
			if (!fr) {
				fr=document.createElement('iframe');
				fr.id=self.preloadFrameId;
				fr.style.display='none';
				fr.setAttribute('sandbox','allow-same-origin'); //allow-scripts
				document.body.appendChild(fr);
			}
			fr.setAttribute('src',url);
			var frl=document.getElementById(self.preloadLinkId);
			if (!frl) {
				frl=document.createElement('link');
				frl.id=self.preloadLinkId;
				frl.setAttribute('rel','prefetch');
				document.body.appendChild(frl);
			}
			frl.setAttribute('href',url);
		}
	};

	global.BookmarkExplorer = BookmarkExplorer;
})();