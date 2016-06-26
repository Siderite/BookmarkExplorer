(function () {

	var global = this;

	function EventHandler(eventRoot, listener) {
		this.disposed = false;
		this.eventRoot = eventRoot;
		this.listener = listener;
		if (eventRoot) {
			eventRoot.addListener(listener);
		}
	}
	EventHandler.prototype = {
		remove : function () {
			if (this.disposed || !this.eventRoot || !this.listener)
				return;
			this.eventRoot.removeListener(this.listener);
			this.disposed = true;
		}
	};

	var regUrl = /^([^\?]*?)[\/]?(\?[^#]+)?(#.*)?$/;

	function ApiWrapper(chr) {
		if (!chr)
			throw "ApiWrapper needs an instance of chrome as a parameter";
		this.chr = chr;
		this.debug = false;
		this.init();
	}

	ApiWrapper.sameUrls = function (u1, u2) {
		if (!u1 || !u2)
			return 0; // empty URLs
		var m1 = regUrl.exec(u1.toLowerCase());
		var m2 = regUrl.exec(u2.toLowerCase());
		if (m1[1] != m2[1])
			return 0; //different
		if (m1[2] != m2[2])
			return 1; //same host
		if (m1[3] != m2[3])
			return 2; //same host and parameters
		return 3; //same host and parameters and hash
	};

	ApiWrapper.throttle = function(f,time) {
		time=+(time)||500;
		var timeout=null;
		return function() {
			var self=this;
			var args=arguments;
			if (timeout) clearTimeout(timeout);
			timeout=setTimeout(function() {
				f.apply(self,args);
			},time);
		};
	};

	ApiWrapper.getIconForUrl = function (url) {
		return 'chrome://favicon/' + url;
	};

	ApiWrapper.prototype = {
		log : function () {
			if (this.debug && arguments.length) {
				for (var i = 0; i < arguments.length; i++) {
					if (typeof(arguments[i]) != 'undefined') {
						console.log(arguments.length == 1 ? arguments[0] : arguments);
					}
				}
			}
		},
		init : function () {
			self = this;
			self.handlers = [];
			if (self.chr && self.chr.tabs && self.chr.tabs.onUpdated) {
				self.onUpdatedTab(function (tabId, changeInfo, tab) {
					if (changeInfo && changeInfo.status == 'complete') {
						self.pushUrlForTab(tabId, tab.url);
					}
				});
			}
			if (self.chr && self.chr.tabs && self.chr.tabs.onRemoved) {
				self.onRemovedTab(function (tabId) {
					self.clearUrlHistory(/*tabId*/
					);
				});
			}
		},
		getCurrentTab : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.query({
						'active' : true,
						'lastFocusedWindow' : true
					}, function (tabs) {
						var tab = tabs[0];
						tab ? resolve(tab) : self.log('No active tab found');
					});
				});
			return promise;
		},
		getAllTabs : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.query({}, resolve);
				});
			return promise;
		},
		getBackgroundPage : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.runtime.getBackgroundPage(resolve);
				});
			return promise;
		},
		setUrl : function (tabId, url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.pushUrlForTab(tabId, url).then(function () {
						self.chr.tabs.update(tabId, {
							url : url
						}, resolve);
					});
				});
			return promise;
		},
		notify : function (text) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.notifications.create(null, {
						type : "basic",
						title : "Siderite's Bookmark Explorer",
						message : (text || ''),
						iconUrl : "bigIcon.png"
					}, resolve);
				});
			return promise;
		},
		getDataSize : function (key) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.storage.local.getBytesInUse(key, resolve);
				});
			return promise;
		},
		getData : function (key) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.storage.local.get(key, function (data) {
						data && data[key] ? resolve(data[key]) : resolve();
					});
				});
			return promise;
		},
		setData : function (key, value) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var obj = {};
					obj[key] = value;
					self.chr.storage.local.set(obj, resolve);
				});
			return promise;
		},
		removeData : function (key, value) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var obj = {};
					obj[key] = value;
					self.chr.storage.local.remove(key, resolve);
				});
			return promise;
		},
		settingsKey : 'settings',
		getSettings : function () {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getData(self.settingsKey).then(function (data) {
					if (!data) {
						self.setSettings({}).then(resolve);
						return;
					};
					resolve(data);
				});
			});
		},
		setSettings : function (settings) {
			var self = this;
			return new Promise(function (resolve, reject) {
				if (!settings) {
					self.getSettings().then(resolve);
					return;
				}
				var data = {
					prevNextContext : typeof(settings.prevNextContext) == 'undefined' ? false : !!settings.prevNextContext,
					manageContext : typeof(settings.manageContext) == 'undefined' ? false : !!settings.manageContext,
					readLaterContext : typeof(settings.readLaterContext) == 'undefined' ? true : !!settings.readLaterContext,
					readLaterFolderName : settings.readLaterFolderName || 'Read Later',
					readLaterPageTimeout: +(settings.readLaterPageTimeout) || 15000,
					storeAllDeletedBookmarks: typeof(settings.storeAllDeletedBookmarks) == 'undefined' ? true : !!settings.storeAllDeletedBookmarks,
					daysAutoClearDeleted: +(settings.daysAutoClearDeleted) || 0,
				};
				self.setData(self.settingsKey, data).then(function () {
					resolve(data);
				});
			});
		},
		setIcon : function (tabId, icon) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.browserAction.setIcon({
						path : {
							'19' : icon
						},
						tabId : tabId
					}, function () {
						self.log(self.getError());
						return resolve.apply(this, arguments)
					});
				});
			return promise;
		},
		getExtensionUrl : function (file) {
			return this.chr.extension.getURL(file);
		},
		getTabById : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.get(tabId, function (tab) {
						tab ? resolve(tab) : self.log('Error getting tab ' + tabId + ': ' + self.getError());
					});
				});
			return promise;
		},
		getTabsByUrl : function (url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.query({
						url : url + '*'
					}, resolve);
				});
			return promise;
		},
		newTab : function (url, notActive) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.create({
						url : url,
						selected : true,
						active : !notActive
					}, resolve);
				});
			return promise;
		},
		closeTab : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.remove(tabId, function () {
						self.log(self.getError());
						return resolve.apply(this, arguments)
					});
				});
			return promise;
		},
		setSelected : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.update(tabId, {
						selected : true
					}, resolve);
				});
			return promise;
		},
		selectOrNew : function (url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getTabsByUrl(url).then(function (tabs) {
						if (!tabs || !tabs[0]) {
							self.newTab(url).then(resolve);
						} else {
							self.setSelected(tabs[0].id).then(resolve);
						}
					});
				});
			return promise;
		},
		getTree : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.bookmarks.getTree(resolve);
				});
			return promise;
		},
		getBookmarksBar : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getTree().then(function (tree) {
						if (!tree || !tree.length || !tree[0].children || !tree[0].children.length) {
							self.log('Error reading bookmarks!');
							return;
						}
						resolve(tree[0].children[0]);
					});
				});
			return promise;
		},
		getBookmarksByIds : function (ids, tree) {
			var self = this;
			if (!tree) {
				var promise = new Promise(function (resolve, reject) {
						self.getTree().then(function (tree) {
							self.getBookmarksByIds(ids, tree).then(resolve);
						});
					});
				return promise;
			}
			function walk(tree, result) {
				var arr = tree.children || tree;
				arr.forEach(function (itm) {
					if (itm.children) {
						walk(itm, result);
					}
					if (ids.includes(itm.id)) {
						result.push(itm);
					}
				});
			};
			var promise = new Promise(function (resolve, reject) {
					var result = [];
					walk(tree, result);
					resolve(result);
				});
			return promise;
		},
		getBookmarksByUrl : function (url, threshold, tree) {
			var self = this;
			threshold =  + (threshold) || 2;
			if (!tree) {
				var promise = new Promise(function (resolve, reject) {
						self.getTree().then(function (tree) {
							self.getBookmarksByUrl(url, threshold, tree).then(resolve);
						});
					});
				return promise;
			}
			function walk(tree, result) {
				var arr = tree.children || tree;
				arr.forEach(function (itm) {
					if (itm.children) {
						walk(itm, result);
					}
					if (ApiWrapper.sameUrls(url, itm.url) >= threshold) {
						result.push(itm);
					}
				});
			};
			var promise = new Promise(function (resolve, reject) {
					var result = [];
					walk(tree, result);
					resolve(result);
				});
			return promise;
		},
		getBookmarksByTitle : function (title, tree) {
			var self = this;
			if (!tree) {
				var promise = new Promise(function (resolve, reject) {
						self.getTree().then(function (tree) {
							self.getBookmarksByTitle(title, tree).then(resolve);
						});
					});
				return promise;
			}
			function walk(tree, result) {
				var arr = tree.children || tree;
				arr.forEach(function (itm) {
					if (itm.children) {
						walk(itm, result);
					}
					if (itm.title == title) {
						result.push(itm);
					}
				});
			};
			var promise = new Promise(function (resolve, reject) {
					var result = [];
					walk(tree, result);
					resolve(result);
				});
			return promise;
		},
		removeBookmarksById : function (ids) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getBookmarksByIds(ids).then(function (bms) {
						bms.forEach(function (bm) {
							self.chr.bookmarks.remove(bm.id, function () {});
						});
						resolve(bms);
					});
				});
			return promise;
		},
		createBookmarks : function (bms) {
			var withArray = Array.isArray(bms);
			if (!withArray) {
				bms = [bms];
			}
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var nodes = [];
					var k = bms.length;
					bms.forEach(function (bm) {
						delete bm.dateAdded;
						delete bm.id;
						self.chr.bookmarks.create(bm, function (node) {
							nodes.push(node);
							k--;
							if (k == 0)
								resolve(withArray ? nodes : nodes[0]);
						});
					});
				});
			return promise;
		},
		deletedBookmarksKey : 'lastDeletedBookmarks',
		ensureCleanDeletedBookmarks : function(arr) {
			var self = this;
			return new Promise(function (resolve, reject) {
				if (!arr||!arr.bookmarks) {
					resolve();
					return;
				}
				self.getSettings().then(function(settings) {
					if (!settings.daysAutoClearDeleted) {
						resolve();
						return;
					}
					var now=new Date();
					var newbms=arr.bookmarks.filter(function(obj) {
						var time=obj.time||new Date('2016-06-26').getTime();
						return (now-time)<=86400000*settings.daysAutoClearDeleted;
					});
					if (newbms.length==arr.bookmarks.length) {
						resolve();
						return;
					}
					arr.bookmarks=newbms;
					self.setData(self.deletedBookmarksKey, arr).then(resolve);
				});
			});
		},
		getDeletedBookmarksSize : function () {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getDataSize(self.deletedBookmarksKey).then(resolve);
			});
		},
		getDeletedBookmarks : function () {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getData(self.deletedBookmarksKey).then(function (arr) {
					if (!arr || !arr.bookmarks || !arr.bookmarks.length) {
						resolve(null);
					} else {
						self.ensureCleanDeletedBookmarks(arr).then(function() {
							resolve(arr.bookmarks);
						});
					}
				});
			});
		},
		addDeletedBookmarks : function (bookmarks) {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getData(self.deletedBookmarksKey).then(function (arr) {
					if (!arr || !arr.bookmarks || !arr.bookmarks.length)
						arr = {
							bookmarks : []
						};
					arr.bookmarks.push({
						time:new Date().getTime(),
						items:bookmarks
					});
					self.setData(self.deletedBookmarksKey, arr).then(resolve);
				});
			});
		},
		removeDeletedBookmarksByIds : function (ids) {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getData(self.deletedBookmarksKey).then(function (arr) {
					if (!arr || !arr.bookmarks || !arr.bookmarks.length) {
						resolve(null);
						return;
					}
					arr.bookmarks.forEach(function (obj) {
						var i = 0;
						while (i < obj.bookmarks.length) {
							if (ids.includes(obj.bookmarks[i].id)) {
								obj.bookmarks.splice(i, 1);
							} else {
								i++;
							}
						}
					});
					arr.bookmarks = arr.bookmarks.filter(function (obj) {
							return !!obj.bookmarks.length;
						});
					self.setData(self.deletedBookmarksKey, arr).then(resolve);
				});
			});
		},
		removeAllDeletedBookmarks : function () {
			var self = this;
			return new Promise(function (resolve, reject) {
				arr = {
					bookmarks : []
				};
				self.setData(self.deletedBookmarksKey, arr).then(resolve);
			});
		},
		createMenuItem : function (id, title, parentId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var itm = {
						"id" : id,
						"title" : title,
						"contexts" : ["page", "frame", "selection", "link", "editable", "image", "video", "audio"]
					};
					if (parentId) itm.parentId=parentId;
					self.chr.contextMenus.create(itm, function () {
						self.log(self.getError());
						resolve(itm);
					});
				});
			return promise;
		},
		removeMenuItem : function (id) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.contextMenus.remove(id, function () {
						self.log(self.getError());
						resolve(arguments);
					});
				});
			return promise;
		},
		sendMessage : function (tabId, data) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var d = data || {};
					var interval = setInterval(function () {
							self.chr.tabs.sendMessage(tabId, d, null, function (val) {
								if (!val)
									return;
								setTimeout(function () {
									clearInterval(interval);
								}, 50);
								resolve.apply(this, arguments);
							});
						}, 100);
				});
			return promise;
		},
		urlHistoryKey : 'urlHistory',
		pushUrlForTab : function (tabId, url) {
			self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getData(self.urlHistoryKey).then(function (history) {
						history = history || {};
						var list = history[tabId];
						if (!list) {
							list = [];
							history[tabId] = list;
						}
						list.push(url);
						self.setData(self.urlHistoryKey, history).then(function () {
							resolve(url);
						});
					});
				});
			return promise;
		},
		getListOfUrls : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getData(self.urlHistoryKey).then(function (history) {
						history = history || {};
						var list = history[tabId];
						list ? resolve(list) : self.log('No history for tab ' + tabId);
					});
				});
			return promise;
		},
		clearUrlHistory : function (tabId) {
			self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getData(self.urlHistoryKey).then(function (history) {
						history = history || {};
						if (tabId) {
							var exists = !!history[tabId];
							delete history[tabId];
							self.setData(self.urlHistoryKey, history).then(function () {
								resolve(exists);
							});
						} else {
							self.getAllTabs().then(function (tabs) {
								var hids = Object.keys(history);
								var tids = tabs.map(function (tab) {
										return tab.id + '';
									});
								hids.forEach(function (id) {
									if (!tids.includes(id)) {
										delete history[id];
									}
								});
								self.setData(self.urlHistoryKey, history).then(function () {
									resolve(true);
								});
							});
						}
					});
				});
			return promise;
		},
		getLastTabBookmarkedUrl : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getListOfUrls(tabId).then(function (list) {
						var i = list.length;
						var f = function () {
							i--;
							if (i < 0) {
								self.log('No bookmarked tab in the history of tab ' + tabId);
								return;
							}
							var url = list[i];
							self.getBookmarksByUrl(url).then(function (bms) {
								if (!bms || !bms.length) {
									f();
									return;
								}
								resolve(url);
							})
						}
						f();
					});
				});
			return promise;
		},
		onUpdatedTab : function (listener) {
			var eh = new EventHandler(this.chr.tabs.onUpdated, listener);
			this.handlers.push(eh);
			return eh;
		},
		onCreatedTab : function (listener) {
			var eh = new EventHandler(this.chr.tabs.onCreated, listener);
			this.handlers.push(eh);
			return eh;
		},
		onRemovedTab : function (listener) {
			var eh = new EventHandler(this.chr.tabs.onRemoved, listener);
			this.handlers.push(eh);
			return eh;
		},
		onActivatedTab : function (listener) {
			var eh = new EventHandler(this.chr.tabs.onActivated, listener);
			this.handlers.push(eh);
			return eh;
		},
		onCreatedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onCreated, listener);
			this.handlers.push(eh);
			return eh;
		},
		onRemovedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onRemoved, listener);
			this.handlers.push(eh);
			return eh;
		},
		onChangedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onChanged, listener);
			this.handlers.push(eh);
			return eh;
		},
		onMovedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onMoved, listener);
			this.handlers.push(eh);
			return eh;
		},
		onChildrenReorderedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onChildrenReordered, listener);
			this.handlers.push(eh);
			return eh;
		},
		onImportEndedBookmark : function (listener) {
			var eh = new EventHandler(this.chr.bookmarks.onImportEnded, listener);
			this.handlers.push(eh);
			return eh;
		},
		onCommand : function (listener) {
			var self = this;
			var handler = new EventHandler();
			handler.commandListener = function (command) {
				listener(command);
			};
			self.chr.commands.onCommand.addListener(handler.commandListener);
			handler.contextMenuListener = function (info, tab) {
				listener(info.menuItemId, info);
			}
			self.chr.contextMenus.onClicked.addListener(handler.contextMenuListener);
			handler.remove = function () {
				if (this.disposed)
					return;
				self.chr.commands.onCommand.removeListener(handler.commandListener);
				self.chr.contextMenus.onClicked.removeListener(handler.contextMenuListener);
				this.disposed = true;
			}
			self.handlers.push(handler);
			return handler;
		},
		onMessage : function (listener) {
			var eh = new EventHandler(this.chr.runtime.onMessage, function (request, sender, sendResponse) {
					var result = listener(request);
					if (typeof(sendResponse) == 'function')
						sendResponse({
							result : result
						});
					return true;
				});
			this.handlers.push(eh);
			return eh;
		},
		getWebStoreUrl : function () {
			return 'https://chrome.google.com/webstore/detail/' + this.chr.runtime.id;
		},
		dispose : function () {
			if (!this.handlers)
				return;
			this.handlers.forEach(function (eh) {
				eh.remove();
			});
			this.handlers = null;
		},
		getError : function () {
			if (this.chr && this.chr.runtime)
				return this.chr.runtime.lastError;
		},
		openOptions : function () {
			return new Promise(function (resolve, reject) {
				chrome.runtime.openOptionsPage(resolve);
			});
		}
	};

	global.ApiWrapper = ApiWrapper;
})();