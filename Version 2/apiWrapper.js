(function () {

	var global = this;

	function EventHandler(eventRoot, listener) {
		this.disposed = false;
		this.eventRoot = eventRoot;
		this.listener = listener;
		if (eventRoot) {
			var params = Array.from(arguments);
			params.splice(0, 1);
			eventRoot.addListener.apply(eventRoot, params);
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

	function ApiWrapper(chr) {
		if (!chr)
			throw "ApiWrapper needs an instance of chrome as a parameter";
		this.chr = chr;
		this.debug = false;
		this.init();
	}

	ApiWrapper.throttle = function (fn, time) {
		time =  + (time) || 500;
		var timeout = null;
		var c = function () {
			clearTimeout(timeout);
			timeout = null;
		};
		var t = function (fn) {
			timeout = setTimeout(fn, time);
		};
		return function () {
			var context = this;
			var args = arguments;
			var f = function () {
				fn.apply(context, args);
			};
			if (!timeout) {
				t(c);
				f();
			} else {
				c();
				t(f);
			}
		}
	}

	ApiWrapper.clone = function (obj) {
		return JSON.parse(JSON.stringify(obj));
	};

	ApiWrapper.urlComparisonDefault = '<default>';
	ApiWrapper.isValidUrlComparisonSchema = function (text) {
		if (!text || !text.trim())
			return false;
		var hasDefault = false;
		var valid = true;
		text.split(/\s*[\r\n]+\s*/).forEach(function (line) {
			if (!line || !line.trim())
				return;
			if (/^#/.test(line))
				return;
			var m = /^([^\s]+)\s+((?:scheme|host|path|params|hash)(?:\s*,\s*(?:scheme|host|path|params|hash))*)$/i.exec(line);
			if (!m)
				valid = false;
			if (m[1].toLowerCase() == ApiWrapper.urlComparisonDefault)
				hasDefault = true;
		});
		return valid && hasDefault;
	};
    ApiWrapper._comparisonOptions={};
	ApiWrapper.getComparisonOptions = function (url, schema) {
		var o = ApiWrapper._comparisonOptions[url];
		if (o) return o;
		var def = null;
		Object.keys(schema).forEach(function (fragment) {
			if (fragment == ApiWrapper.urlComparisonDefault)
				def = schema[fragment];
			if (url.includes(fragment))
				o = schema[fragment];
		});
		if (!def)
			self.log('urlComparisonSchema default not set!');
		o = o || def;
		ApiWrapper._comparisonOptions[url]=o;
		return o;
	};
	var regUrl = /^\s*(?:([^:]+):(?:\/\/)?)?([^\/\?#]*)[\/]?([^\?#]*?)[\/]?(\?[^#]*?)?(#.*)?\s*$/;
	ApiWrapper.getUrlOptions = function(url, schema) {
		url = url && url.trim() ? url.toLowerCase() : '';
		var result = {
			options: ApiWrapper.getComparisonOptions(url, schema),
			match: url ? regUrl.exec(url) : ['', '', '', '', '']
		}
		return result;
	}
	ApiWrapper.compareUrlOptions = function(opt1, opt2, extraOptions) {
		var o1 = opt1.options;
		var o2 = opt2.options;
		var options = extraOptions || {};
		options.scheme = options.scheme || o1.scheme || o2.scheme;
		options.host = options.host || o1.host || o2.host;
		options.path = options.path || o1.path || o2.path;
		options.params = options.params || o1.params || o2.params;
		options.hash = options.hash || o1.hash || o2.hash;

		var m1 = opt1.match;
		var m2 = opt2.match;

		var result = 0;
		var different = false;
		if ((m1[1] || 'http') != (m2[1] || 'http')) {
			result += 20;
			different = different || options.scheme;
		}
		if (m1[2] != m2[2]) {
			result += 50;
			different = different || options.host;
		}
		if (m1[3] != m2[3]) {
			result += 40;
			different = different || options.path;
		}
		if (m1[4] != m2[4]) {
			result += 30;
			different = different || options.params;
		}
		if (m1[5] != m2[5]) {
			result += 10;
			different = different || options.hash;
		}
		return {
			different : different,
			value : result
		};
	};
	ApiWrapper.compareUrls = function(u1, u2, schema, extraOptions) {
		if (!schema) {
			throw "No comparison schema set";
		}
		var opt1 = ApiWrapper.getUrlOptions(u1, schema);
		var opt2 = ApiWrapper.getUrlOptions(u2, schema);
		return ApiWrapper.compareUrlOptions(op1, opt2, extraOptions);
	};

	ApiWrapper.cleanUrl=function(url) {
		if (!url) return url;
		var uri=new URL(url);
		uri.search = uri.search
			.replace(/utm_[^&]+&?/g, '')
			.replace(/(wkey|wemail)=[^&]+&?/g, '')
			.replace(/(_hsenc|_hsmi|hsCtaTracking)=[^&]+&?/g, '')
			.replace(/(trk|trkEmail|midToken|fromEmail|ut|origin|anchorTopic|lipi)=[^&]+&?/g, '')
			.replace(/&$/, '')
			.replace(/^\?$/, '');
		uri.hash = uri.hash
			.replace(/#\.[a-z0-9]{9}$/g,'');
		return uri.toString();
	};

	ApiWrapper.getBrowser = function() {
		if (ApiWrapper._browser) return ApiWrapper._browser;
		var browser={
			isOpera:false,
			isChrome:false,
			isSafari:false,
			isFirefox:false,
			isIE:false
		};

		var ag=navigator.userAgent;
		if (ag.indexOf("Opera")!=-1 || ag.indexOf('OPR') != -1 ) 
    	{
        	browser.isOpera=true;
    	}
    	else if (ag.indexOf("Chrome") != -1 )
    	{
        	browser.isChrome=true;
    	}
    	else if(ag.indexOf("Safari") != -1)
    	{
        	browser.isSafari=true;
    	}
    	else if(ag.indexOf("Firefox") != -1 ) 
    	{
        	browser.isFirefox=true;
    	}
    	else if((ag.indexOf("MSIE") != -1 ) || !!document.documentMode) //IF IE > 10
    	{
      		browser.isIE=true;
    	}  
		ApiWrapper._browser=browser;
		return browser;
	}

	ApiWrapper.getIconForUrl = function (url) {
		if (!url) return url;
		var browser=ApiWrapper.getBrowser();
		if (browser.isChrome) {
			return 'chrome://favicon/' + url;
		}
		var m=regUrl.exec(url);
		return m[1]+'://'+m[2]+'/favicon.ico';
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
			var self = this;
			self.handlers = [];
			self.notifications = {};
			if (self.chr && self.chr.tabs && self.chr.tabs.onUpdated) {
				self.onUpdatedTab(function (tabId, changeInfo, tab) {
					if (changeInfo && changeInfo.status == 'complete') {
						self.pushUrlForTab(tabId, tab.url);
					}
				});
			}
			if (self.chr && self.chr.tabs && self.chr.tabs.onRemoved) {
				self.onRemovedTab(function (tabId) {
					self.clearUrlHistory(/*tabId*/);
				});
			}
			if (self.chr && self.chr.tabs && self.chr.tabs.onActivated) {
				self.onActivatedTab(function (data) {
					if (data.tabId)
						self.lastActivatedTabId = data.tabId;
				});
			}
			var browser=ApiWrapper.getBrowser();
			if (!browser.isFirefox&&!browser.isOpera) {
				if (self.chr && self.chr.notifications && self.chr.notifications.onButtonClicked) {
					self.chr.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
						var options=self.notifications[notifId];
						if (options&&options.buttons) {
							var btn=options.buttons[btnIdx];
							if (btn && btn.clicked) {
								btn.clicked();
							}
						}
					});
				}
			}
		},
		getUrlComparisonSchema : function (text) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.getSettings().then(function (settings) {
						var urlComparisonSchema = {};
						settings.urlComparisonSchema.split(/\s*[\r\n]+\s*/).forEach(function (line) {
							if (!line || !line.trim())
								return;
							if (/^#/.test(line))
								return;
							var m = /^([^\s]+)\s+((?:scheme|host|path|params|hash)(?:\s*,\s*(?:scheme|host|path|params|hash))*)$/i.exec(line);
							urlComparisonSchema[m[1].toLowerCase()] = {
								scheme : m[2].includes('scheme'),
								host : m[2].includes('host'),
								path : m[2].includes('path'),
								params : m[2].includes('params'),
								hash : m[2].includes('hash')
							};
						});
						resolve(urlComparisonSchema);
					});
				});
			return promise;
		},
		getCurrentTab : function () {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					self.chr.tabs.query({
						'active' : true,
						'lastFocusedWindow' : true
					}, function (tabs) {
						var tab = tabs[0];
						if (tab) {
							resolve(tab);
						} else {
							if (self.lastActivatedTabId) {
								self.log('No active tab in lastActivatedWindow found, trying last activated tab id');
								self.chr.tabs.query({
									'active' : true
								}, function (tabs) {
									tab = tabs.filter(function (t) {
											return t.id == self.lastActivatedTabId;
										})[0];
									if (tab) {
										resolve(tab);
									} else {
										self.log('No active tab found with the lastActivatedTabId found');
									}
								});
							} else {
								self.log('No active tab in lastActivatedWindow found and last activated tab id is not set');
							}
						}
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
		notify : function (options) {
			if (!options) return;
			if (typeof(options)=="string") {
				options={ message : options };
			}
            if (Array.isArray(options)) {
				if (!options.length) return;
				options={ items : options };
			}
			var self = this;
			var browser=ApiWrapper.getBrowser();
			var promise = new Promise(function (resolve, reject) {
					var notifOpts={
						type : "basic",
						title : (options.title||"Siderite's Bookmark Explorer"),
						message : (options.message || ''),
						iconUrl : "bigIcon.png"
					};
					if (!browser.isFirefox) {
						notifOpts.requireInteraction = !!options.requireInteraction;
					}
					if (options.items&&options.items.length) {
						notifOpts.type = "list";
						notifOpts.items = options.items.map(function(text) { return {title:'',message:text}; });
					}
					if (options.buttons&&options.buttons.length) {
						if (browser.isFirefox||browser.isOpera) {
							self.log("Notification buttons in Firefox and Opera do not work.");
						} else {
							notifOpts.buttons = options.buttons.map(function(btn) { return {title:btn.title,iconUrl:btn.iconUrl}; });
						}
					}
					self.chr.notifications.create(null, notifOpts, function(notificationId) {
						if (options.buttons&&options.buttons.length) {
							self.notifications[notificationId]=options;
						}
						options.notificationId = notificationId;
						resolve(notificationId);
					});
				});
			return promise;
		},
		closeNotification : function(id) {
			if (!id) return;
			var self = this;
			var promise = new Promise(function (resolve, reject) {
				self.chr.notifications.clear(id,resolve);
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
		expandSettings : function (settings) {
			settings = settings || {};
			var data = {
				prevNextContext : typeof(settings.prevNextContext) == 'undefined' ? false : !!settings.prevNextContext,
				hideSkipButton : typeof(settings.hideSkipButton) == 'undefined' ? false : !!settings.hideSkipButton,
				manageContext : typeof(settings.manageContext) == 'undefined' ? false : !!settings.manageContext,
				readLaterContext : typeof(settings.readLaterContext) == 'undefined' ? true : !!settings.readLaterContext,
				readLaterFolderName : settings.readLaterFolderName || 'Read Later',
				readLaterPageTimeout :  + (settings.readLaterPageTimeout) || 30000,
				storeAllDeletedBookmarks : typeof(settings.storeAllDeletedBookmarks) == 'undefined' ? true : !!settings.storeAllDeletedBookmarks,
				daysAutoClearDeleted :  + (settings.daysAutoClearDeleted) || 0,
				enableBookmarkPage : typeof(settings.enableBookmarkPage) == 'undefined' ? false : !!settings.enableBookmarkPage,
				confirmBookmarkPage : typeof(settings.confirmBookmarkPage) == 'undefined' ? true : !!settings.confirmBookmarkPage,
				preloadNext : typeof(settings.preloadNext) == 'undefined' ? true : !!settings.preloadNext,
				showCurrentIndex : typeof(settings.showCurrentIndex) == 'undefined' ? true : !!settings.showCurrentIndex,
				showDuplicateNotifications : typeof(settings.showDuplicateNotifications) == 'undefined' ? true : !!settings.showDuplicateNotifications,
				skipPageNotBookmarkedOnNavigate : typeof(settings.skipPageNotBookmarkedOnNavigate) == 'undefined' ? false : !!settings.skipPageNotBookmarkedOnNavigate,
				urlComparisonSchema : ApiWrapper.isValidUrlComparisonSchema(settings.urlComparisonSchema)
				 ? settings.urlComparisonSchema
				 : ApiWrapper.urlComparisonDefault + ' host, path\r\n#examples:\r\n#www.somedomain.com scheme, host, path, params, hash\r\n#/documents path, hash',
				showBlogInvitation : typeof(settings.showBlogInvitation) == 'undefined' ? true : !!settings.showBlogInvitation,
				lastShownBlogInvitation : settings.lastShownBlogInvitation,
				cleanUrls : typeof(settings.cleanUrls) == 'undefined' ? true : !!settings.cleanUrls
			};
			return data;
		},
		getSettings : function () {
			var self = this;
			return new Promise(function (resolve, reject) {
				self.getData(self.settingsKey).then(function (data) {
					data = self.expandSettings(data);
					resolve(data);
				});
			});
		},
		setSettings : function (settings) {
			ApiWrapper._comparisonOptions={};
			var self = this;
			return new Promise(function (resolve, reject) {
				var data = self.expandSettings(settings);
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
		setBadge : function (tabId, text, color) {
			var self = this;
			color = color || 'black';
			var promise = new Promise(function (resolve, reject) {
					var id =  + (tabId);
					if (id) {
						self.chr.browserAction.setBadgeText({
							text : (text || '') + '',
							tabId : id
						});
						self.chr.browserAction.setBadgeBackgroundColor({
							color : color,
							tabId : id
						});
					}
					return resolve.apply(this);
				});
			return promise;
		},
		setTitle : function (tabId, text) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var id =  + (tabId);
					if (id) {
						self.chr.browserAction.setTitle({
							title : (text || '') + '',
							tabId : id
						});
					}
					return resolve.apply(this);
				});
			return promise;
		},
		getExtensionUrl : function (file) {
			return this.chr.extension.getURL(file);
		},
		getOptionsUrl : function () {
			return 'chrome://extensions/?options=' + this.chr.runtime.id;
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
					var browser=ApiWrapper.getBrowser();
					if (browser.isFirefox) {
						url=url.replace(/^moz-extension/,'*');
					}
					if (browser.isOpera) {
						url=url.replace(/^opera/,'*');
					}
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
						active : true
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
						var bar = tree[0].children.filter(function(itm) {
							return itm.id == 'toolbar_____' || itm.id == '1';
						})[0];
						if (!bar) {
							self.log('Couldn not find bookmars toolbar!');
							return;
						}
						resolve(bar);
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
				if (!Array.isArray(arr)) return;
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
		getBookmarksByUrl : function (url, extraOptions, tree) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					if (!tree) {
						self.getTree().then(function (tree) {
							self.getBookmarksByUrl(url, extraOptions, tree).then(resolve);
						});
						return;
					}
					self.getUrlComparisonSchema().then(function (schema) {
						var result = [];
						function walk(tree) {
							var arr = tree.children || tree;
							if (!Array.isArray(arr)) return;
							arr.forEach(function (itm) {
								if (itm.children) {
									walk(itm);
								}
								if (!ApiWrapper.compareUrls(url, itm.url, schema, extraOptions).different) {
									result.push(itm);
								}
							});
						}
						walk(tree);
						resolve(result);
					});
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
				if (!Array.isArray(arr)) return;
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
			var browser=ApiWrapper.getBrowser();
			if (browser.isFirefox) {
				bms.reverse();
			}
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var nodes = [];
					var k = bms.length;
					bms.forEach(function (bm) {
						var newBm = ApiWrapper.clone(bm);
						delete newBm.dateAdded;
						delete newBm.id;
						self.chr.bookmarks.create(newBm, function (node) {
							nodes.push(node);
							k--;
							if (k == 0)
								resolve(withArray ? nodes : nodes[0]);
						});
					});
				});
			return promise;
		},
		updateBookmark : function (id, changes) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
				self.chr.bookmarks.update(id, changes, resolve);
			});
			return promise;
		},
		deletedBookmarksKey : 'lastDeletedBookmarks',
		ensureCleanDeletedBookmarks : function (arr) {
			var self = this;
			return new Promise(function (resolve, reject) {
				if (!arr || !arr.bookmarks) {
					resolve();
					return;
				}
				self.getSettings().then(function (settings) {
					if (!settings.daysAutoClearDeleted) {
						resolve();
						return;
					}
					var now = new Date();
					var newbms = arr.bookmarks.filter(function (obj) {
							var time = obj.time || new Date('2016-06-26').getTime();
							return (now - time) <= 86400000 * settings.daysAutoClearDeleted;
						});
					if (newbms.length == arr.bookmarks.length) {
						resolve();
						return;
					}
					arr.bookmarks = newbms;
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
						self.ensureCleanDeletedBookmarks(arr).then(function () {
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
						time : new Date().getTime(),
						items : bookmarks
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
			var contexts = ["all"];
			if (typeof(id) == 'object') {
				var options = id;
				id = options.id;
				title = options.title;
				parentId = options.parentId;
				contexts = options.contexts || contexts;
			}
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var itm = {
						"id" : id,
						"title" : title,
						"contexts" : contexts
					};
					if (parentId)
						itm.parentId = parentId;
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
		sendMessageTimeout:5000,
		sendMessageInterval:null,
		sendMessage : function (data) {
			var self = this;
			var promise = new Promise(function (resolve, reject) {
					var d = data || {};
					var time=0;
					if (self.sendMessageInterval) {
						clearInterval(self.sendMessageInterval);
					}
					self.sendMessageInterval = setInterval(function () {
						self.chr.runtime.sendMessage(null, d, null, function (val) {
							self.log(self.getError());
							if (!val)
								return;
							setTimeout(function () {
								clearInterval(self.sendMessageInterval);
							}, 50);
							resolve.apply(this, arguments);
						});
						time+=100;
						if (time>=self.sendMessageTimeout) {
							if (self.sendMessageInterval) {
								clearInterval(self.sendMessageInterval);
							}
							resolve();
						}
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
