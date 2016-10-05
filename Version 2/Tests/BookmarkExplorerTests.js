QUnit.module("BookmarkExplorer");

QUnit.test("BookmarkExplorer init", function (assert) {
	assert.throws(function () {
		new BookmarkExplorer();
	}, "BookmarkExplorer crashes with no parameter");
	var api = {
		onCreatedTab : function () {
			this.onCreatedTabListener = arguments[0];
		},
		onUpdatedTab : function () {
			this.onUpdatedTabListener = arguments[0];
		},
		onRemovedTab : function () {
			this.onRemovedTabListener = arguments[0];
		},
		onActivatedTab : function () {
			this.onActivatedTabListener = arguments[0];
		},
		onCreatedBookmark : function () {
			this.onCreatedBookmarkListener = arguments[0];
		},
		onRemovedBookmark : function () {
			this.onRemovedBookmarkListener = arguments[0];
		},
		onChangedBookmark : function () {
			this.onChangedBookmarkListener = arguments[0];
		},
		onMovedBookmark : function () {
			this.onMovedBookmarkListener = arguments[0];
		},
		onChildrenReorderedBookmark : function () {
			this.onChildrenReorderedBookmarkListener = arguments[0];
		},
		onImportEndedBookmark : function () {
			this.onImportEndedBookmarkListener = arguments[0];
		},
		onCommand : function () {
			this.onCommandListener = arguments[0];
		}
	};
	assert.ok(new BookmarkExplorer(api, true), "BookmarkExplorer init binds to an ApiWrapper"); //avoid initial refresh
	assert.ok(api.onUpdatedTabListener && typeof(api.onUpdatedTabListener) == 'function', "BookmarkExplorer init binds to api.onUpdatedTab");
	assert.ok(api.onCreatedTabListener && typeof(api.onCreatedTabListener) == 'function', "BookmarkExplorer init binds to api.onCreatedTab");
	var refresh = api.onCreatedTabListener;
	assert.equal(api.onRemovedTabListener, refresh, "BookmarkExplorer init binds to api.onRemovedTab");
	assert.equal(api.onActivatedTabListener, refresh, "BookmarkExplorer init binds to api.onActivatedTab");
	assert.equal(api.onCreatedBookmarkListener, refresh, "BookmarkExplorer init binds to api.onCreatedBookmark");
	assert.equal(!!api.onRemovedBookmarkListener, true, "BookmarkExplorer init binds to api.onRemovedBookmark");
	assert.equal(api.onChangedBookmarkListener, refresh, "BookmarkExplorer init binds to api.onChangedBookmark");
	assert.equal(api.onMovedBookmarkListener, refresh, "BookmarkExplorer init binds to api.onMovedBookmark");
	assert.equal(api.onChildrenReorderedBookmarkListener, refresh, "BookmarkExplorer init binds to api.onChildrenReorderedBookmark");
	assert.equal(api.onImportEndedBookmarkListener, refresh, "BookmarkExplorer init binds to api.onImportEndedBookmark");

});

QUnit.test("BookmarkExplorer openManage", function (assert) {
	var tree = [];
	var api = {
		getExtensionUrl : function (url) {
			return 'ext:' + url;
		},
		getTree : function () {
			return Promise.resolve(tree);
		},
		selectOrNew : function (url) {
			api.selectOrNewUrl = url;
			return Promise.resolve({
				id : 12,
				status : 'complete'
			});
		},
		sendMessage : function (tabId, message) {
			this.sendMessageTabId = tabId;
			this.sendMessageMessage = message;
		}
	};
	var app = new BookmarkExplorer(api, true); //avoid initial refresh
	var a = assert.async();
	setTimeout(function () {
		assert.notOk(api.selectOrNewUrl, "BookmarkExplorer does not populate selectOrNewUrl by default");
		assert.notOk(api.sendMessageTabId, "BookmarkExplorer does not populate sendMessageTabId by default");
		assert.notOk(api.sendMessageMessage, "BookmarkExplorer does not populate sendMessageMessage by default");

		app.openManage("test url");

		stringFunctions(function () {
			assert.equal(api.selectOrNewUrl, 'ext:manage.html', "BookmarkExplorer openManage opens manage.html");
			assert.equal(api.sendMessageTabId, 12, "BookmarkExplorer openManage sends a message to the opened window");
			assert.deepEqual(api.sendMessageMessage, null, "BookmarkExplorer openManage sens the correct message");

			tree = [{
					url : "test url"
				}
			];
			app.openManage("test url");

		}, function () {

			assert.equal(api.selectOrNewUrl, 'ext:manage.html', "BookmarkExplorer openManage opens manage.html");
			assert.equal(api.sendMessageTabId, 12, "BookmarkExplorer openManage sends a message to the opened window");
			assert.deepEqual(api.sendMessageMessage, {
				"current" : {
					"url" : "test url"
				},
				"folder" : [{
						"url" : "test url"
					}
				],
				"index" : 0,
				"length" : 1,
				"next" : null,
				"notifications" : [],
				"path" : undefined,
				"prev" : null
			}, "BookmarkExplorer openManage sens the correct message");

			tree = [{
					url : "not test url"
				}
			];
			app.openManage("test url");

		}, function () {
			assert.equal(api.selectOrNewUrl, 'ext:manage.html', "BookmarkExplorer openManage opens manage.html");
			assert.equal(api.sendMessageTabId, 12, "BookmarkExplorer openManage sends a message to the opened window");
			assert.deepEqual(api.sendMessageMessage, null, "BookmarkExplorer openManage sens the correct message");

			tree = [{
					title : "title 1",
					children : [{
							url : "not test url"
						}, {
							title : "title 2",
							url : "test url"
						}, {
							url : "not test url"
						}
					]
				}, {
					title : "title 3",
					children : [{
							url : "not test url"
						}, {
							title : "title 4",
							url : "test url"
						}, {
							url : "not test url"
						}
					]
				}
			];
			app.openManage("test url");

		}, function () {
			assert.equal(api.selectOrNewUrl, 'ext:manage.html', "BookmarkExplorer openManage opens manage.html");
			assert.equal(api.sendMessageTabId, 12, "BookmarkExplorer openManage sends a message to the opened window");
			assert.deepEqual(api.sendMessageMessage, {
				"current" : {
					"title" : "title 2",
					"url" : "test url"
				},
				"folder" : {
					"children" : [{
							"url" : "not test url"
						}, {
							"title" : "title 2",
							"url" : "test url"
						}, {
							"url" : "not test url"
						}
					],
					"title" : "title 1"
				},
				"index" : 1,
				"length" : 3,
				"next" : {
					"url" : "not test url"
				},
				"notifications" : [
					"Using the one in \"title 1\"@2",
					"\"title 4\" in \"title 3\" (test url) is a duplicate!"
				],
				"path" : "title 1",
				"prev" : {
					"url" : "not test url"
				}
			}, "BookmarkExplorer openManage sens the correct message");
		}, a);
	}, 1);
});

QUnit.test("BookmarkExplorer getInfo", function (assert) {
	var tree = [];
	var api = {
		getTree : function () {
			return Promise.resolve(tree);
		}
	};
	var app = new BookmarkExplorer(api, true); //avoid initial refresh
	var a = assert.async();

	app.getInfo("test url").then(function (result) {
		assert.deepEqual(result, null, "BookmarkExplorer getInfo returns the correct result when URL is not found");
	}).then(function () {

		tree = [{
				url : "test url"
			}
		];

		app.getInfo("test url").then(function (result) {
			assert.deepEqual(result, {
				"current" : {
					"url" : "test url"
				},
				"folder" : [{
						"url" : "test url"
					}
				],
				"index" : 0,
				"length" : 1,
				"next" : null,
				"notifications" : [],
				"path" : undefined,
				"prev" : null
			}, "BookmarkExplorer getInfo returns the correct result when URL is found and no next or previous bookmarks");
		}).then(function () {

			tree = [{
					title : "title 1",
					children : [{
							url : "not test url"
						}, {
							title : "title 2",
							url : "test url"
						}, {
							url : "not test url"
						}
					]
				}, {
					title : "title 3",
					children : [{
							url : "not test url"
						}, {
							title : "title 4",
							url : "test url"
						}, {
							url : "not test url"
						}
					]
				}
			];

			app.getInfo("test url").then(function (result) {
				assert.deepEqual(result, {
					"current" : {
						"title" : "title 2",
						"url" : "test url"
					},
					"folder" : {
						"children" : [{
								"url" : "not test url"
							}, {
								"title" : "title 2",
								"url" : "test url"
							}, {
								"url" : "not test url"
							}
						],
						"title" : "title 1"
					},
					"index" : 1,
					"length" : 3,
					"next" : {
						"url" : "not test url"
					},
					"notifications" : [
						"Using the one in \"title 1\"@2",
						"\"title 4\" in \"title 3\" (test url) is a duplicate!"
					],
					"path" : "title 1",
					"prev" : {
						"url" : "not test url"
					}
				}, "BookmarkExplorer getInfo returns the correct result when URL is found, has previous and next bookmarks and there are multiple bookmarks for the same URL");
			}).then(a);
		});
	});
});

QUnit.test("BookmarkExplorer execute", function (assert) {
	var tree = [{
			url : "prev url"
		}, {
			url : "test url"
		}, {
			url : "next url"
		}
	];
	var api = {
		getExtensionUrl : function (url) {
			return 'ext:' + url;
		},
		getTree : function () {
			return Promise.resolve(tree);
		},
		selectOrNew : function (url) {
			api.selectOrNewUrl = url;
			return Promise.resolve({
				id : 12,
				status : 'complete'
			});
		},
		sendMessage : function (tabId, message) {
			this.sendMessageTabId = tabId;
			this.sendMessageMessage = message;
		},
		getCurrentTab : function () {
			return new Promise(function (resolve, reject) {
				resolve({
					id : 12,
					url : "test url"
				});
			});
		},
		setUrl : function (tabId, url) {
			return new Promise(function (resolve, reject) {
				api.setUrlTabId = tabId;
				api.setUrlTabUrl = url;
				resolve({
					url : url
				});
			});
		}
	};
	var app = new BookmarkExplorer(api, true); //avoid initial refresh
	app.execute("manage");
	var a = assert.async();
	stringFunctions(function () {

		assert.equal(api.selectOrNewUrl, 'ext:manage.html', "BookmarkExplorer execute manage opens manage.html");
		app.execute('prevBookmark');

	}, function () {
		assert.equal(api.setUrlTabId, 12, "BookmarkExplorer execute prevBookmark attempts to change the url of the correct tab");
		assert.equal(api.setUrlTabUrl, "prev url", "BookmarkExplorer execute prevBookmark attempts to set the correct url");
		app.execute('nextBookmark');

	}, function () {
		assert.equal(api.setUrlTabId, 12, "BookmarkExplorer execute prevBookmark attempts to change the url of the correct tab");
		assert.equal(api.setUrlTabUrl, "next url", "BookmarkExplorer execute prevBookmark attempts to set the correct url");

	}, a);
});

QUnit.test("BookmarkExplorer refreshManage", function (assert) {
	var currentTab = {
		url : "test url"
	};
	var api = {
		getExtensionUrlFile : [],
		getTabsByUrlUrl : [],
		getExtensionUrl : function (file) {
			api.getExtensionUrlFile.push(file);
			return "ext:" + file;
		},
		getOptionsUrl : function() {
			return "ext:options";
		},
		getTabsByUrl : function (url) {
			api.getTabsByUrlUrl.push(url);
			return new Promise(function (resolve, reject) {
				resolve([]);
			});
		}
	};
	var app = new BookmarkExplorer(api, true); //avoid initial refresh
	app.refreshManage(currentTab);
	var a = assert.async()
		stringFunctions(function () {
			assert.deepEqual(api.getExtensionUrlFile, ["manage.html", "deleted.html", "settings.html"], "BookmarkExplorer refreshManage gets the correct URLs for manage, settings and deleted.html");
			assert.equal(api.getTabsByUrlUrl, "ext:manage.html", "BookmarkExplorer refreshManage searches the tab for manage.html");
		}, a);
});

QUnit.test("BookmarkExplorer refreshIconAndMenu", function (assert) {
	var currentTab = {
		id : 12,
		url : "test url"
	};
	var tree = [];

	var api = {
		getExtensionUrl : function (url) {
			return 'ext:' + url;
		},
		setIcon : function (tabId, icon) {
			api.setIconCalls.push(arguments);
			return new Promise(function (resolve, reject) {
				resolve({});
			});
		},
		getTree : function () {
			api.getTreeCalled++;
			return new Promise(function (resolve, reject) {
				resolve(tree);
			});
		},
		removeMenuItem : function (id) {
			api.removeMenuItemCalls.push(arguments);
			return new Promise(function (resolve, reject) {
				resolve({});
			});
		},
		createMenuItem : function (id, title) {
			api.createMenuItemCalls.push(arguments);
			return new Promise(function (resolve, reject) {
				resolve({});
			});
		},
		reset : function () {
			api.setIconCalls = [];
			api.getTreeCalled = 0;
			api.removeMenuItemCalls = [];
			api.createMenuItemCalls = [];
		},
		getSettings : function () {
			return Promise.resolve({
				prevNextContext : true,
				manageContext : true,
				readLaterContext : true,
				readLaterFolderName : 'Read Later'
			});
		}
	};
	var app = new BookmarkExplorer(api, true); //avoid initial refresh
	api.reset();
	app.refreshIconAndMenu(currentTab);
	var a = assert.async()
		stringFunctions(function () {
			assert.deepEqual(api.setIconCalls,
				[{
						"0" : 12,
						"1" : "icon-gray.png"
					}
				], "BookmarkExplorer refreshIconAndMenu sets the icon correctly");
			assert.deepEqual(api.getTreeCalled, 1, "BookmarkExplorer refreshIconAndMenu gets the bookmark");
			assert.deepEqual(api.removeMenuItemCalls, [{
						"0" : "prevBookmark"
					}, {
						"0" : "nextBookmark"
					}, {
						"0" : "readLinkLater"
					}, {
						"0" : "readPageLater"
					}
				], "BookmarkExplorer refreshIconAndMenu removes the correct menu items");
			assert.deepEqual(api.createMenuItemCalls, [{
						"0" : "manage",
						"1" : "Manage bookmark folder"
					}, {
						"0" : {
							"contexts" : [
								"link"
							],
							"id" : "readLinkLater",
							"title" : "Read link later"
						}
					}/*, {
						"0" : {
							"contexts" : [
								"page"
							],
							"id" : "readPageLater",
							"title" : "Read page later"
						}
					}*/
				], "BookmarkExplorer refreshIconAndMenu creates the correct menu items");

			tree = [{
					title : 'title 1',
					children : [{
							title : 'title 3',
							url : 'test url'
						}, {
							title : 'title 4',
							url : 'next url'
						}
					]
				}, {
					title : 'title 5',
					children : [{
							title : 'title other',
							url : 'other url'
						}, {
							title : 'title other',
							url : 'other url'
						}
					]
				}
			];

			api.reset();
			app.refreshIconAndMenu(currentTab);

		}, function () {
			assert.deepEqual(api.setIconCalls,
				[{
						"0" : 12,
						"1" : "icon.png"
					}
				], "BookmarkExplorer refreshIconAndMenu sets the icon correctly");
			assert.deepEqual(api.getTreeCalled, 1, "BookmarkExplorer refreshIconAndMenu gets the bookmark");
			assert.deepEqual(api.removeMenuItemCalls,
				[{
						"0" : "prevBookmark"
					}, {
						"0" : "readLinkLater"
					}, {
						"0" : "readPageLater"
					}
				], "BookmarkExplorer refreshIconAndMenu removes the correct menu items");
			assert.deepEqual(api.createMenuItemCalls,
				[{
						"0" : "manage",
						"1" : "Manage bookmark folder"
					}, {
						"0" : "nextBookmark",
						"1" : "Navigate to next bookmark (Ctrl-Shift-L)"
					}, {
						"0" : {
							"contexts" : [
								"link"
							],
							"id" : "readLinkLater",
							"title" : "Read link later"
						}
					}/*, {
						"0" : {
							"contexts" : [
								"page"
							],
							"id" : "readPageLater",
							"title" : "Read page later"
						}
					}*/
				], "BookmarkExplorer refreshIconAndMenu creates the correct menu items");

			tree = [{
					title : 'title 1',
					children : [{
							title : 'title 2',
							url : 'prev url'
						}, {
							title : 'title 3',
							url : 'test url'
						}, {
							title : 'title 4',
							url : 'next url'
						}
					]
				}, {
					title : 'title 5',
					children : [{
							title : 'title other',
							url : 'other url'
						}, {
							title : 'title other',
							url : 'other url'
						}
					]
				}
			];

			api.reset();
			app.refreshIconAndMenu(currentTab);

		}, function () {
			assert.deepEqual(api.setIconCalls,
				[{
						"0" : 12,
						"1" : "icon.png"
					}
				], "BookmarkExplorer refreshIconAndMenu sets the icon correctly");
			assert.deepEqual(api.getTreeCalled, 1, "BookmarkExplorer refreshIconAndMenu gets the bookmark");
			assert.deepEqual(api.removeMenuItemCalls,
				[{
						"0" : "readLinkLater"
					}, {
						"0" : "readPageLater"
					}
				], "BookmarkExplorer refreshIconAndMenu removes the correct menu items");
			assert.deepEqual(api.createMenuItemCalls,
				[{
						"0" : "manage",
						"1" : "Manage bookmark folder"
					}, {
						"0" : "prevBookmark",
						"1" : "Navigate to previous bookmark (Ctrl-Shift-K)"
					}, {
						"0" : "nextBookmark",
						"1" : "Navigate to next bookmark (Ctrl-Shift-L)"
					}, {
						"0" : {
							"contexts" : [
								"link"
							],
							"id" : "readLinkLater",
							"title" : "Read link later"
						}
					}/*, {
						"0" : {
							"contexts" : [
								"page"
							],
							"id" : "readPageLater",
							"title" : "Read page later"
						}
					}*/
				], "BookmarkExplorer refreshIconAndMenu creates the correct menu items");
		}, a);
});

QUnit.test("BookmarkExplorer dispose", function (assert) {
	var api = {
		dispose : function () {
			api.disposed = true;
		}
	};
	var app = new BookmarkExplorer(api, true);
	assert.notOk(api.disposed, "BookmarkExplorer doesn't populate disposed before dispose");
	app.dispose();
	assert.equal(api.disposed, true, "BookmarkExplorer dispose calls api.dispose");
});