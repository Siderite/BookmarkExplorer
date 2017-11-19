(function () {

	const global = this;

	class BookmarkExplorer {
		constructor(api, noInitialRefresh) {
			if (!api || typeof(api) != "object")
				throw ('BookmarkExplorer needs an ApiWrapper instance as the first constructor parameter');
			this.api = api;
			this.inviteToBlogIntervalInDays = 100;
			this.preloadFrameId = 'ifrPreload';
			this.preloadLinkId = 'lnkPreload';
			this.preloadLinkId2 = 'lnkPreload2';
			this.lastExploredFolderId = null;
			this.init(noInitialRefresh);
		}

		init(noInitialRefresh) {
			const self = this;
			const refresh = self.refresh.bind(self);
			if (self.api.onUpdatedTab) {
				self.api.onUpdatedTab((tabId, changeInfo, tab) => {
					refresh();
					if (changeInfo && changeInfo.status == 'complete') {
						self.getInfo(tab.url).then(data => {
							self.handleDuplicates(data, tab).then(data => {
								if (data && data.current && tab.url == data.current.url) {
									self.api.notify(data.notifications);
								}
							});
						});
					}
				});
			}

			if (self.api.onCreatedTab) {
				self.api.onCreatedTab(() => {
					refresh();
				});
			}
			if (self.api.onRemovedTab) {
				self.api.onRemovedTab(() => {
					refresh();
				});
			}
			if (self.api.onActivatedTab) {
				self.api.onActivatedTab(() => {
					refresh();
				});
			}

			if (self.api.onCreatedBookmark) {
				self.api.onCreatedBookmark((id, bm) => {
					self.api.getSettings().then(settings => {
						if (bm.url && settings.cleanUrls) {
							const newUrl = ApiWrapper.cleanUrl(bm.url);
							if (newUrl != bm.url) {
								self.api.updateBookmark(id, {
									url : newUrl
								}).then(() => {
									refresh(true);
								});
							}
						} else {
							refresh(true);
						}
					});
				});
			}
			if (self.api.onRemovedBookmark) {
				const bookmarksToStore = [];
				const removeBookmarksThrottled = ApiWrapper.throttle(() => {
						self.api.addDeletedBookmarks(bookmarksToStore).then(() => {
							bookmarksToStore.splice(0, 10000);
							refresh(true);
						});
					});
				self.api.onRemovedBookmark((id, data) => {
					self.api.getSettings().then(settings => {
						if (settings.storeAllDeletedBookmarks) {
							if (data && data.node) {
								const bookmark = data.node;
								bookmark.index = data.index;
								bookmark.parentId = data.parentId;
								(() => {
										const f = bm => {
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
							refresh(true);
						}
					});
				});
			}
			if (self.api.onChangedBookmark) {
				self.api.onChangedBookmark(() => {
					refresh(true);
				});
			}
			if (self.api.onMovedBookmark) {
				self.api.onMovedBookmark(() => {
					refresh(true);
				});
			}
			if (self.api.onChildrenReorderedBookmark) {
				self.api.onChildrenReorderedBookmark(() => {
					refresh(true);
				});
			}
			if (self.api.onImportEndedBookmark) {
				self.api.onImportEndedBookmark(() => {
					refresh(true);
				});
			}

			if (self.api.onCommand) {
				self.api.onCommand(function () {
					self.execute(...arguments);
				});
			}
			if (!noInitialRefresh) {
				refresh();
			}
		}

		dispose() {
			if (!this.api)
				return;
			this.api.dispose();
			this.api = null;
		}

		openManage(url) {
			const self = this;
			const manageUrl = self.api.getExtensionUrl('manage.html');
			self.getInfo(url).then(data => {
				self.api.getCurrentTab().then(currentTab => {
					self.handleDuplicates(data, currentTab).then(data => {
						self.api.selectOrNew(manageUrl).then(() => {
							self.api.sendMessage(data);
						});
					});
				});
			});
		}

		openSettings(url) {
			const self = this;
			self.api.openOptions();
		}

		openDeleted(url) {
			const self = this;
			const deletedUrl = self.api.getExtensionUrl('deleted.html');
			self.api.selectOrNew(deletedUrl);
		}

		refresh(forced) {
			const self = this;
			self.api.getCurrentTab().then(tab => {
				if (tab.url) {
					self.refreshIconAndMenu(tab);
					self.refreshManage(tab, forced);
				}
			});
		}

		refreshManage(currentTab, forced) {
			const self = this;
			const manageUrl = self.api.getExtensionUrl('manage.html');
			const ownUrls = [manageUrl, self.api.getExtensionUrl('deleted.html'), self.api.getExtensionUrl('settings.html'), self.api.getOptionsUrl()];
			if (ownUrls.includes(currentTab.url) || currentTab.url.startsWith('chrome:') || currentTab.url.startsWith('moz-extension:') || currentTab.url.startsWith('opera:')) {
				if (forced || currentTab.url != manageUrl) {
					self.api.sendMessage("current");
				}
				return;
			}
			self.getInfo(currentTab.url).then(data => {
				self.handleDuplicates(data, currentTab).then(data => {
					self.api.sendMessage(data);
				});
			});
		}

		refreshIconAndMenu(currentTab) {
			const self = this;
			const manageUrl = self.api.getExtensionUrl('manage.html');
			const browser = ApiWrapper.getBrowser();
			self.api.getSettings().then(settings => {
				self.getInfo(currentTab.url).then(data => {
					self.handleDuplicates(data, currentTab).then(data => {
						if (settings.manageContext) {
							self.api.createMenuItem('manage', 'Manage bookmark folder');
						} else {
							self.api.removeMenuItem('manage');
						}
						self.api.setIcon(currentTab.id, data ? 'icon.png' : 'icon-gray.png');
						self.api.toggleIcon(currentTab.id, true);
						if (data && data.prev && settings.prevNextContext) {
							let text = 'Navigate to previous bookmark ';
							if (browser.isChrome) {
								text += '(Ctrl-Shift-K)';
							} else {
								text += '(Ctrl-Shift-O)';
							}
							self.api.createMenuItem('prevBookmark', 'Navigate to previous bookmark (Ctrl-Shift-O)');
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
							const n = {};
							(settings.readLaterFolderName || 'Read Later').split(/,/).forEach(name => {
								if (name)
									n[name] = true;
							});
							const names = Object.keys(n);
							if (names.length > 1) {
								names.forEach(name => {
									self.api.createMenuItem({
										id : `readLinkLater ${name}`,
										title : name,
										parentId : 'readLinkLater',
										contexts : ["link"]
									});
									self.api.createMenuItem({
										id : `readPageLater ${name}`,
										title : name,
										parentId : 'readPageLater',
										contexts : ["page", "frame", "selection", "editable", "image", "video", "audio"]
									});
								});
							}
						}
						if (settings.showCurrentIndex && data) {
							self.api.setBadge(currentTab.id, data.index + 1, '#909090');
							self.api.setTitle(currentTab.id, `${data.path} : ${data.index + 1}/${data.length}`);
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
		}

		addReadLaterBookmark(bm, folderName) {
			const self = this;
			return new Promise((resolve, reject) => {
				self.api.getBookmarksBar().then(bar => {
					self.api.getBookmarksByTitle(folderName).then(bms => {
						const rl = bms.filter(itm => itm.parentId == bar.id)[0];
						if (!rl) {
							self.api.createBookmarks({
								parentId : bar.id,
								title : folderName
							}).then(() => {
								self.addReadLaterBookmark(bm, folderName).then(resolve);
							});
							return;
						}
						self.api.getBookmarksByUrl(bm.url, {
							params : true
						}, rl).then(existing => {
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
		}

		readLater(url, folderName) {
			const self = this;
			const data = {
				url,
				title : null
			};
			self.api.newTab(url, true).then(tab => {
				self.api.getSettings().then(settings => {
					let newTabId = tab.id;
					let tm = null;
					let eh = null;
					let f = timeout => {
						if (tm)
							clearTimeout(tm);
						tm = setTimeout(() => {
								self.addReadLaterBookmark({
									url : data.url,
									title : data.title
								}, folderName).then(() => {
									if (eh)
										eh.remove();
									setTimeout(() => {
										self.api.closeTab(newTabId);
									}, 1);
								});
							}, timeout || 1);
					};
					f(settings.readLaterPageTimeout);
					eh = self.api.onUpdatedTab((tabId, changeInfo, updatedTab) => {
							if (newTabId != tabId || !changeInfo || !(changeInfo.url || changeInfo.title || changeInfo.favIconUrl)) {
								return;
							}
							let timeout=null;
							if (changeInfo.url)
								timeout = 0.7 * settings.readLaterPageTimeout;
							if (changeInfo.title)
								timeout = 0.4 * settings.readLaterPageTimeout;
							if (changeInfo.favIconUrl)
								timeout = 0.2 * settings.readLaterPageTimeout;
							data.title = updatedTab.title;
							data.url = updatedTab.url;
							f(timeout);
						});
				});
			});
		}

		execute(command, info) {
			const self = this;
			self.api.getCurrentTab().then(tab => {
				if (command.startsWith('readLinkLater') || command.startsWith('readPageLater')) {
					if (!info)
						return;
					const folderName = command.substr(13 /*length of readLinkLater and readPageLater*/).trim() || 'Read Later';
					if (info.linkUrl) {
						self.readLater(info.linkUrl, folderName);
						return;
					}
					self.api.getSettings().then(settings => {
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
				self.getInfo(tab.url).then(data => {
					self.handleDuplicates(data, tab).then(data => {
						switch (command) {
						case 'prevBookmark':
							if (!data || !data.prev) {
								self.api.getLastTabBookmarkedUrl(tab.id).then(url => {
									self.getInfo(url).then(data => {
										self.handleDuplicates(data, tab).then(data => {
											if (!data) {
												self.api.notify('Page not bookmarked');
												return;
											}
											if (!data.prev) {
												self.api.notify('Reached the start of the bookmark folder');
												return;
											}
											self.api.getSettings().then(settings => {
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
								self.api.getLastTabBookmarkedUrl(tab.id).then(url => {
									self.getInfo(url).then(data => {
										self.handleDuplicates(data, tab).then(data => {
											if (!data) {
												self.api.notify('Page not bookmarked');
												return;
											}
											if (!data.next) {
												self.api.notify('Reached the end of the bookmark folder');
												return;
											}
											self.api.getSettings().then(settings => {
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
							const bm = ApiWrapper.clone(data.current);
							delete bm.index;
							self.api.createBookmarks(bm)
							self.api.removeBookmarksById([bm.id]);
							self.api.setUrl(tab.id, data.next.url);
							break;
						}
					});
				});
			});
		}

		inviteToBlog() {
			const self = this;
			self.api.getSettings().then(settings => {
				if (settings.showBlogInvitation) {
					const browser = ApiWrapper.getBrowser();
					const now =  + (new Date());
					const firstTime = !settings.lastShownBlogInvitation;
					if (settings.lastShownBlogInvitation && now - settings.lastShownBlogInvitation <= self.inviteToBlogIntervalInDays * 86400000) {
						return;
					}
					settings.lastShownBlogInvitation = now;
					self.api.setSettings(settings).then(() => {
						let notification;
						if (browser.isFirefox) {
							notification = {
								title : "Visit Siderite's Blog",
								message : "Use this link to ask for features, report bugs or discuss the extension:\r\nhttps://siderite.blogspot.com/2016/03/my-first-chrome-extension-bookmark.html",
							};
							settings.showBlogInvitation = false;
							if (!firstTime) {
								self.api.setSettings(settings).then(() => {
									setTimeout(() => {
										self.api.notify('Find the blog entry link in the extension Options');
									}, 10000);
								});
							}
						} else {
							notification = {
								title : "Visit Siderite's Blog",
								message : "Click on the link below to ask for features, report bugs or discuss the extension",
								buttons : [{
										title : 'https://siderite.blogspot.com/2016/03/my-first-chrome-extension-bookmark.html',
										clicked() {
											self.api.selectOrNew(this.title);
										}
									}, {
										title : 'Never show this again',
										clicked() {
											self.api.closeNotification(notification.notificationId);
											self.api.getSettings().then(settings => {
												settings.showBlogInvitation = false;
												self.api.setSettings(settings).then(() => {
													self.api.notify('Find the blog entry link in the extension Options');
												});
											});
										}
									}
								],
								requireInteraction : true
							};
							if (firstTime) {
								notification.buttons.splice(1, 1);
							}
						}
						self.api.notify(notification);
					});

				}
			});
		}

		getInfo(url) {
			const self = this;
			const promise = new Promise((resolve, reject) => {
					self.api.getUrlComparisonSchema().then(schema => {
						function walk(tree, path) {
							let result = [];

							function setResult(r, itm) {
								result = result.concat(r);
							}

							if (tree.title) {
								if (path) {
									path += ` -> ${tree.title}`;
								} else {
									path = tree.title;
								}
							}
							const arr = tree.children || tree;
							const urlOptions = ApiWrapper.getUrlOptions(url, schema);
							arr.forEach((itm, idx) => {
								if (itm.children) {
									const r = walk(itm, path);
									if (r)
										setResult(r, itm);
								}
								const itmUrlOptions = ApiWrapper.getUrlOptions(itm.url, schema);
								if (!ApiWrapper.compareUrlOptions(itmUrlOptions, urlOptions).different) {
									let prev = null;
									for (let i = idx - 1; i >= 0; i--) {
										if (arr[i].url) {
											prev = arr[i];
											break;
										}
									}
									let next = null;
									for (let i = idx + 1; i < arr.length; i++) {
										if (arr[i].url) {
											next = arr[i];
											break;
										}
									}
									setResult({
										folder : tree,
										prev,
										current : itm,
										next,
										index : idx,
										length : arr.length,
										path,
										notifications : []
									}, itm);
								}
							});
							return result;
						}
						self.api.getTree().then(tree => {
							const info = walk(tree);
							resolve(info);
						});
					});
				});
			self.inviteToBlog();
			return promise;
		}

		preload(url) {
			const self = this;
			const time = BookmarkExplorer.preloadedUrls[url];
			const now = (new Date()).getTime();
			BookmarkExplorer.preloadedUrls[url] = now;
			if (time && now - time < 86400000)
				return;
			let fr = document.getElementById(self.preloadFrameId);
			if (!fr) {
				fr = document.createElement('iframe');
				fr.id = self.preloadFrameId;
				fr.style.display = 'none';
				fr.setAttribute('sandbox', 'allow-same-origin'); //allow-scripts
				document.body.appendChild(fr);
			}
			fr.setAttribute('src', url);
			let frl = document.getElementById(self.preloadLinkId);
			if (!frl) {
				frl = document.createElement('link');
				frl.id = self.preloadLinkId;
				frl.setAttribute('rel', 'prefetch');
				frl.setAttribute('as', 'document');
				document.body.appendChild(frl);
			}
			let frl2 = document.getElementById(self.preloadLinkId2);
			if (!frl2) {
				frl2 = document.createElement('link');
				frl2.id = self.preloadLinkId2;
				frl2.setAttribute('rel', 'prerender');
				frl2.setAttribute('as', 'document');
				document.body.appendChild(frl2);
			}
			frl2.setAttribute('href', url);
		}

		handleDuplicates(arr, tab) {
			const self = this;
			const promise = new Promise((resolve, reject) => {

					if (!tab) {
						self.api.getCurrentTab().then(currentTab => {
							self.handleDuplicates(arr, currentTab).then(resolve);
						});
						return;
					}

					function max(str, size) {
						if (!str)
							return '';
						if (str.length <= size - 1)
							return str;
						return `${str.substr(0, size)}\u2026`;
					}

					switch (arr.length) {
					case 0:
						resolve(null);
						break;
					case 1:
						const result = arr[0];
						self.lastExploredFolderId = result.folder.id;
						resolve(result);
						break;
					default:
						self.api.getUrlComparisonSchema().then(schema => {
							self.api.getListOfUrls(tab.id).then(urls => {
								let result = [];
								if (self.lastExploredFolderId) {
									result = arr.filter(itm => itm.folder.id == self.lastExploredFolderId);
									if (result.length > 1) {
										arr = result;
									}
								}
								if (result.length != 1) {
									if (urls.length) {
										for (let i = 1; i < 5; i++) {
											const url = urls[urls.length - i];
											result = arr.filter(itm => (itm.prev && !ApiWrapper.compareUrls(itm.prev.url, url, schema).different) ||
													(itm.next && !ApiWrapper.compareUrls(itm.next.url, url, schema).different));
											if (result.length)
												break;
										}
									}
								}
								result = result.length ? result[0] : arr[0];
								self.lastExploredFolderId = result.folder.id;
								self.api.getSettings().then(settings => {
									if (settings.showDuplicateNotifications) {
										result.notifications.push('Duplicate bookmarks found:');

										arr.forEach(r => result.notifications.push(`- "${max(r.current.title, 50)}" in "${max(r.folder.title, 20)}" (${max(r.current.url, 50)})`));
										result.notifications.push(`Using the one in "${max(result.folder.title, 20)}"@${result.index + 1}`);
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
	}
	BookmarkExplorer.preloadedUrls = {};

	global.BookmarkExplorer = BookmarkExplorer;
})();
