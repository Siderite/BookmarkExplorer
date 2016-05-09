//TODO: handle any error (runtime.lastError)

(function () {

	var global=this;

	function EventHandler(eventRoot, listener) {
		this.disposed=false;
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

	var regUrl = /^([^\?]*?)[\/]?(\?[^#]+)?(#.+)?$/;

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
			self.history = {};
			self.handlers = [];
			if (self.chr && self.chr.tabs && self.chr.tabs.onUpdated) {
				self.onUpdatedTab(function (tabId, changeInfo, tab) {
					if (changeInfo && changeInfo.status == 'complete') {
						self.pushUrlForTab(tabId,tab.url);
					}
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
				self.pushUrlForTab(tabId,url).then(function() {
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
						message : text,
						iconUrl : "bigIcon.png"
					}, resolve);
				});
			return promise;
		},
		getData : function (key) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.storage.local.get(key, function (data) {
						data && data[key]?resolve(data[key]):resolve();
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
		setIcon : function (tabId, icon) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.browserAction.setIcon({
						path : {
							'19' : icon
						},
						tabId : tabId
					}, resolve);
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
						tab ? resolve(tab) : self.log('Error getting tab ' + tabId + ': ' + self.chr.runtime.lastError);
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
		newTab : function (url) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.create({
						url : url,
						selected : true
					}, resolve);
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
		removeBookmarksById : function (ids) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getBookmarksByIds(ids).then(function (bms) {
						bms.forEach(function (bm) {
							self.chr.bookmarks.remove(bm.id,function() {});
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
					bms.forEach(function (bm) {
						delete bm.dateAdded;
						delete bm.id;
						self.chr.bookmarks.create(bm, function (node) {
							nodes.push(node);
						});
					});
					resolve(withArray ? nodes : nodes[0]);
				});
			return promise;
		},
		createMenuItem : function (id, title) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var itm = {
						"id" : id,
						"title" : title,
						"contexts" : ["page", "frame", "selection", "link", "editable", "image", "video", "audio"]
					};
					self.chr.contextMenus.create(itm, function () {
						self.log(self.chr.runtime.lastError);
						resolve(itm);
					});
				});
			return promise;
		},
		removeMenuItem : function (id) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.contextMenus.remove(id, function () {
						self.log(self.chr.runtime.lastError);
						resolve(arguments);
					});
				});
			return promise;
		},
		sendMessage : function (tabId, data) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var d=data||{};
					var interval=setInterval(function() {
						self.chr.tabs.sendMessage(tabId, d, null, function() {
							setTimeout(function() { clearInterval(interval); },50);
							resolve.apply(this,arguments);
						});
					});
				});
			return promise;
		},
		pushUrlForTab:function(tabId,url) {
			self = this;
			var promise = new Promise(function (resolve, reject) {
				var list = self.history[tabId];
				if (!list) {
					list = [];
					self.history[tabId] = list;
				}
				list.push(url);
				resolve(url);
			});
			return promise;
		},
		getListOfUrls : function (tabId) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var list = self.history[tabId];
					list ? resolve(list) : self.log('No history for tab ' + tabId);
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
			var self=this;
			var handler = new EventHandler();
			handler.commandListener = function (command) {
				listener(command);
			};
			self.chr.commands.onCommand.addListener(handler.commandListener);
			handler.contextMenuListener = function (info, tab) {
				listener(info.menuItemId);
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
			var eh = new EventHandler(this.chr.runtime.onMessage, listener);
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
		}
	};

	global.ApiWrapper = ApiWrapper;
})();