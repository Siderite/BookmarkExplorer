(function () {

	var global = this;

	function BookmarkExplorer(api, noInitialRefresh) {
		if (!api || typeof(api) != "object")
			throw ('BookmarkExplorer needs an ApiWrapper instance as the first constructor parameter');
		this.api = api;
		this.init(noInitialRefresh);
	}

	BookmarkExplorer.preloadedUrls = {};

	BookmarkExplorer.prototype = {
		init : function (noInitialRefresh) {
			var self = this;
			var refresh = self.refresh.bind(self);
			if (self.api.onUpdatedTab) {
				self.api.onUpdatedTab(function (tabId, changeInfo, tab) {
					refresh();
					if (changeInfo && changeInfo.status == 'complete') {
						self.getInfo(tab.url).then(function (data) {
							self.handleDuplicates(data, tab).then(function (data) {
								if (data && data.current && tab.url == data.current.url) {
									self.api.notify(data.notifications);
								}
							});
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
				var bookmarksToStore = [];
				var removeBookmarksThrottled = ApiWrapper.throttle(function () {
						self.api.addDeletedBookmarks(bookmarksToStore).then(function () {
							bookmarksToStore.splice(0, 10000);
							refresh();
						});
					});
				self.api.onRemovedBookmark(function (id, data) {
					self.api.getSettings().then(function (settings) {
						if (settings.storeAllDeletedBookmarks) {
							if (data && data.node) {
								var bookmark = data.node;
								bookmark.index = data.index;
								bookmark.parentId = data.parentId;
								(function () {
									var f = function (bm) {
										if (bm.url) {
											bookmarksToStore.push(bm);
										} else if (bm.children && bm.children.length) {
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
				self.api.getCurrentTab().then(function (currentTab) {
					self.api.selectOrNew(manageUrl).then(function (tab) {
						self.handleDuplicates(data, currentTab).then(function (data) {
							self.api.sendMessage(tab.id, data);
						});
					});
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
				if (ownUrls.includes(currentTab.url) || currentTab.url.startsWith('chrome:')) {
					self.api.sendMessage(tab.id, "current");
					return;
				}
				self.getInfo(currentTab.url).then(function (data) {
					self.handleDuplicates(data, currentTab).then(function (data) {
						self.api.sendMessage(tab.id, data);
					});
				});
			});
		},
		refreshIconAndMenu : function (currentTab) {
			var self = this;
			var manageUrl = self.api.getExtensionUrl('manage.html');
			self.api.getSettings().then(function (settings) {
				self.getInfo(currentTab.url).then(function (data) {
					self.handleDuplicates(data, currentTab).then(function (data) {
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
						if (data && data.next && settings.prevNextContext) {
							self.api.createMenuItem('skipBookmark', 'Skip bookmark (move it to the end of the folder)');
						} else {
							self.api.removeMenuItem('skipBookmark');
						}
						self.api.removeMenuItem('readLinkLater');
						self.api.removeMenuItem('readPageLater');
						if (settings.readLaterContext) {
							self.api.createMenuItem({
								id : 'readLinkLater',
								title : 'Read link later',
								contexts : ["link"]
							});
							if (settings.enableBookmarkPage) {
								self.api.createMenuItem({
									id : 'readPageLater',
									title : 'Read page later',
									contexts : ["page"]
								});
							}
							var n = {};
							(settings.readLaterFolderName || 'Read Later').split(/,/).forEach(function (name) {
								if (name)
									n[name] = true;
							});
							var names = Object.keys(n);
							if (names.length > 1) {
								names.forEach(function (name) {
									self.api.createMenuItem({
										id : 'readLinkLater ' + name,
										title : name,
										parentId : 'readLinkLater',
										contexts : ["link"]
									});
									self.api.createMenuItem({
										id : 'readPageLater ' + name,
										title : name,
										parentId : 'readPageLater',
										contexts : ["page", "frame", "selection", "editable", "image", "video", "audio"]
									});
								});
							}
						}
						if (settings.showCurrentIndex && data) {
							self.api.setBadge(currentTab.id, data.index + 1, '#909090');
							self.api.setTitle(currentTab.id, data.path + ' : ' + (data.index + 1) + '/' + data.length);
						} else {
							self.api.setBadge(currentTab.id, '');
							self.api.setTitle(currentTab.id, 'Siderite\'s Bookmark Explorer');
						}
						if (settings.preloadNext && data && data.next) {
							self.preload(data.next.url);
						}
					});
				});
			});
		},
		addReadLaterBookmark : function (bm, folderName) {
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
								self.addReadLaterBookmark(bm, folderName).then(resolve);
							});
							return;
						}
						self.api.getBookmarksByUrl(bm.url, {
							params : true
						}, rl).then(function (existing) {
							if (existing && existing.length) {
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
		readLater : function (url, folderName) {
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
								}, folderName).then(function () {
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
				if (command.startsWith('readLinkLater') || command.startsWith('readPageLater')) {
					if (!info)
						return;
					var folderName = command.substr(13 /*length of readLinkLater and readPageLater*/).trim() || 'Read Later';
					if (info.linkUrl) {
						self.readLater(info.linkUrl, folderName);
						return;
					}
					self.api.getSettings().then(function (settings) {
						if (info.pageUrl && (!settings.confirmBookmarkPage || confirm('No link selected. Do you want me to bookmark the current page?'))) {
							self.addReadLaterBookmark({
								url : tab.url,
								title : tab.title
							}, folderName);
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
					self.handleDuplicates(data, tab).then(function (data) {
						switch (command) {
						case 'prevBookmark':
							if (!data || !data.prev) {
								self.api.getLastTabBookmarkedUrl(tab.id).then(function (url) {
									self.getInfo(url).then(function (data) {
										self.handleDuplicates(data, tab).then(function (data) {
											if (!data) {
												self.api.notify('Page not bookmarked');
												return;
											}
											if (!data.prev) {
												self.api.notify('Reached the start of the bookmark folder');
												return;
											}
											self.api.getSettings().then(function (settings) {
												if (settings.skipPageNotBookmarkedOnNavigate || confirm('Page not bookmarked. Continue from last bookmarked page opened in this tab?')) {
													self.api.setUrl(tab.id, data.prev.url);
												}
											});
										});
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
										self.handleDuplicates(data, tab).then(function (data) {
											if (!data) {
												self.api.notify('Page not bookmarked');
												return;
											}
											if (!data.next) {
												self.api.notify('Reached the end of the bookmark folder');
												return;
											}
											self.api.getSettings().then(function (settings) {
												if (settings.skipPageNotBookmarkedOnNavigate || confirm('Page not bookmarked. Continue from last bookmarked page opened in this tab?')) {
													self.api.setUrl(tab.id, data.next.url);
												}
											});
										});
									});
								});
							} else {
								self.api.setUrl(tab.id, data.next.url);
							}
							break;
						case 'skipBookmark':
							if (!data) {
								self.api.notify('Page not bookmarked');
								return;
							}
							if (!data.next) {
								self.api.notify('Reached the end of the bookmark folder');
								return;
							}
							var bm = ApiWrapper.clone(data.current);
							delete bm.index;
							self.api.createBookmarks(bm)
							self.api.removeBookmarksById([bm.id]);
							self.api.setUrl(tab.id, data.next.url);
							break;
						}
					});
				});
			});
		},
		inviteToBlogIntervalInDays:100,
		inviteToBlog : function() {
			var self = this;
			self.api.getSettings().then(function(settings) {
				if (settings.showBlogInvitation) {
					var now=+(new Date());
					if (!settings.lastShownBlogInvitation||now-settings.lastShownBlogInvitation>self.inviteToBlogIntervalInDays*86400000) {
						settings.lastShownBlogInvitation=now;
						self.api.setSettings(settings).then(function() {
							self.api.notify({
								title : "Visit Siderite's Blog",
								message : "Click on the link below to ask for features, report bugs or discuss the extension",
								buttons : [
									{
										title : 'https://siderite.blogspot.com/2016/03/my-first-chrome-extension-bookmark.html',
										clicked : function () {
											self.api.selectOrNew(this.title);
										}
									},
									{
										title : 'Never show this again',
										clicked : function() {
											self.api.getSettings().then(function(settings) {
												settings.showBlogInvitation=false;
												self.api.setSettings(settings).then(function() {
													self.api.notify('Find the link in the extension options');
												});
											});
										}
									}
								],
								requireInteraction : true
							});
						});
					}
				}
			});
		},
		getInfo : function (url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.api.getUrlComparisonSchema().then(function (schema) {
						function walk(tree, path) {
							var result = [];

							function setResult(r, itm) {
								result = result.concat(r);
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
										setResult(r, itm);
								}
								if (!ApiWrapper.compareUrls(itm.url, url, schema).different) {
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
									setResult({
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
							var info = walk(tree);
							resolve(info);
						});
					});
				});
			self.inviteToBlog();
			return promise;
		},
		preloadFrameId : 'ifrPreload',
		preloadLinkId : 'lnkPreload',
		preload : function (url) {
			var self = this;
			var time = BookmarkExplorer.preloadedUrls[url];
			var now = (new Date()).getTime();
			BookmarkExplorer.preloadedUrls[url] = now;
			if (time && now - time < 86400000)
				return;
			var fr = document.getElementById(self.preloadFrameId);
			if (!fr) {
				fr = document.createElement('iframe');
				fr.id = self.preloadFrameId;
				fr.style.display = 'none';
				fr.setAttribute('sandbox', 'allow-same-origin'); //allow-scripts
				document.body.appendChild(fr);
			}
			fr.setAttribute('src', url);
			var frl = document.getElementById(self.preloadLinkId);
			if (!frl) {
				frl = document.createElement('link');
				frl.id = self.preloadLinkId;
				frl.setAttribute('rel', 'prefetch');
				frl.setAttribute('as', 'document');
				document.body.appendChild(frl);
			}
			frl.setAttribute('href', url);
		},
		lastExploredFolderId : null,
		handleDuplicates : function (arr, tab) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {

					if (!tab) {
						self.api.getCurrentTab().then(function (currentTab) {
							self.handleDuplicates(arr, currentTab).then(resolve);
						});
						return;
					}

					function max(str, size) {
						if (!str)
							return '';
						if (str.length <= size - 1)
							return str;
						return str.substr(0, size) + '\u2026';
					}

					switch (arr.length) {
					case 0:
						resolve(null);
						break;
					case 1:
						var result = arr[0];
						self.lastExploredFolderId = result.folder.id;
						resolve(result);
						break;
					default:
						self.api.getUrlComparisonSchema().then(function (schema) {
							self.api.getListOfUrls(tab.id).then(function (urls) {
								var result = [];
								if (self.lastExploredFolderId) {
									result = arr.filter(function (itm) {
											return itm.folder.id == self.lastExploredFolderId;
										});
									if (result.length > 1) {
										arr = result;
									}
								}
								if (result.length != 1) {
									if (urls.length) {
										for (var i = 1; i < 5; i++) {
											var url = urls[urls.length - i];
											result = arr.filter(function (itm) {
													return (itm.prev && !ApiWrapper.compareUrls(itm.prev.url, url, schema).different) ||
													(itm.next && !ApiWrapper.compareUrls(itm.next.url, url, schema).different);
												});
											if (result.length)
												break;
										}
									}
								}
								result = result.length ? result[0] : arr[0];
								self.lastExploredFolderId = result.folder.id;
								self.api.getSettings().then(function (settings) {
									if (settings.showDuplicateNotifications) {
										result.notifications.push('Duplicate bookmarks found:');
										for (var i = 0; i < arr.length; i++) {
											var r = arr[i];
											result.notifications.push('- "' + max(r.current.title, 50) + '" in "' + max(r.folder.title, 20) + '" (' + max(r.current.url, 50) + ')');
										}
										result.notifications.push('Using the one in "' + max(result.folder.title, 20) + '"@' + (result.index + 1));
									}
									resolve(result);
								});
							});
						});
						break;
					}
				});
			return promise;
		}
	};

	global.BookmarkExplorer = BookmarkExplorer;
})();
