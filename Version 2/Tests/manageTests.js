QUnit.module("Manage.js");

QUnit.test("Manage script", function (assert) {

	var old = ApiWrapper.getIconForUrl;
	ApiWrapper.getIconForUrl = function () {
		return "about:blank";
	};
	var a = assert.async();

	(function () {
		var global = this;
		global.testContext = {};
		global.testContext.document = $('<section><div id="divHeader"></div>' +
				'<div id="divSubheader"></div>' +
				'<div id="divCounts"><span></span></div>' +
				'<div id="divTree"></div>' +
				'<div id="divButtons">' +
				'	<button id="btnToggleAll">Toggle All</button>' +
				'	<button id="btnToggleBefore">Toggle Before Current</button>' +
				'	<button id="btnRemove">Delete Selected</button>' +
				'	<button id="btnUndo">Undo Last Bookmark Delete</button>' +
				'</div></section>');
		function contextReset() {
			global.testContext.tree = [];
			global.testContext.localData = null;
			global.testContext.storageRemove = [];
			global.testContext.storageGet = [];
			global.testContext.storageSet = [];
			global.testContext.getTreeCalled = 0;
			global.testContext.bookmarksCreate = [];
			global.testContext.bookmarksRemove = [];
			global.testContext.notificationsCreate = [];
		}
		contextReset();
		global.testContext.chrome = {
			runtime : {
				onMessage : {
					addListener : function (listener) {
						messageListener = listener;
					}
				}
			},
			storage : {
				local : {
					get : function (key, callback) {
						global.testContext.storageGet.push(key);
						callback(global.testContext.localData);
					},
					set : function (values, callback) {
						global.testContext.storageSet.push(values);
						callback(global.testContext.localData);
					},
					remove : function (key, callback) {
						global.testContext.storageRemove.push(key);
						callback({});
					}
				}
			},
			bookmarks : {
				getTree(callback) {
					global.testContext.getTreeCalled++;
					callback(global.testContext.tree);
				},
				create(bookmark, callback) {
					global.testContext.bookmarksCreate.push(bookmark);
					callback({});
				},
				remove(id, callback) {
					global.testContext.bookmarksRemove.push(id);
					callback({});
				}
			},
			notifications : {
				create : function (tabId, notification, callback) {
					global.testContext.notificationsCreate.push(notification);
					callback({});
				}
			}
		};
		global.testContext.confirm = function () {
			return true;
		};

		var tc = global.testContext.document;
		var scr = $('<script></script>');
		scr.on('load', function () {
			assert.ok(messageListener && typeof(messageListener) == 'function', "Initial load binds a listener to onMessage");

			assert.equal($('#btnToggleAll', tc).css('display') == 'none', true, "Initial load with no data hides ToggleAll button");
			assert.equal($('#btnToggleBefore', tc).css('display') == 'none', true, "Initial load with no data hides ToggleBefore button");
			assert.equal($('#btnRemove', tc).css('display') == 'none', true, "Initial load with no data hides Remove button");
			assert.equal($('#btnUndo', tc).css('display') == 'none', true, "Initial load with no deleted bookmarks hides Undo button");
			assert.equal($('#divHeader', tc).text(), 'Bookmark for the URL not found', "Initial load with no deleted bookmarks populates title");
			assert.equal($('#divSubheader', tc).text(), 'Move to a tab that has been bookmarked to populate this page.', "Initial load with no deleted bookmarks populates subtitle");

			var data = {
				"current" : {
					"title" : "title 2",
					"url" : "test url"
				},
				"folder" : {
					"children" : [{
							"id" : "test id 1",
							"title" : "prev title",
							"url" : "prev url"
						}, {
							"id" : "test id 2",
							"title" : "title 2",
							"url" : "test url"
						}, {
							"id" : "test id 3",
							"title" : "next title",
							"url" : "next url"
						}
					],
					"title" : "title 1"
				},
				"index" : 1,
				"next" : {
					"url" : "not test url"
				},
				"notifications" : [
					"title 4 in title 3 (test url) is a duplicate bookmark! Using the one in title 1@2"
				],
				"path" : "title 1",
				"prev" : {
					"url" : "not test url"
				}
			};
			messageListener(data);

			stringFunctions(function () {
				assert.equal($('#btnToggleAll', tc).css('display') == 'none', false, "Refresh with data shows ToggleAll button");
				assert.equal($('#btnToggleBefore', tc).css('display') == 'none', false, "Refresh with data shows ToggleBefore button");
				assert.equal($('#btnRemove', tc).css('display') == 'none', true, "Refresh with data, but no selected items hides Remove button");
				assert.equal($('#btnUndo', tc).css('display') == 'none', true, "Refresh with data, but no deleted bookmarks hides Undo button");
				assert.equal($('#divHeader', tc).text(), 'title 1', "Refresh with data shows correct title");
				assert.equal($('#divTree ul li', tc).length, 3, "Refresh with data shows correct number of items");
				$('#divTree ul li', tc).each(function (idx) {
					assert.ok($(this).html().includes(data.folder.children[idx].url), "item " + (idx + 1) + " contains the correct url");
					assert.ok($(this).text().includes(data.folder.children[idx].title), "item " + (idx + 1) + " contains the correct title");
				});

				contextReset();
				messageListener(null);
			}, function () {

				assert.equal($('#btnToggleAll', tc).css('display') == 'none', true, "Refresh with no data hides ToggleAll button");
				assert.equal($('#btnToggleBefore', tc).css('display') == 'none', true, "Refresh with no data hides ToggleBefore button");
				assert.equal($('#btnRemove', tc).css('display') == 'none', true, "Refresh with no data hides Remove button");
				assert.equal($('#btnUndo', tc).css('display') == 'none', true, "Refresh with no deleted bookmarks hides Undo button");
				assert.equal($('#divHeader', tc).text(), 'Bookmark for the URL not found', "Refresh with no deleted bookmarks populates title");
				assert.equal($('#divSubheader', tc).text(), 'Move to a tab that has been bookmarked to populate this page.', "Refresh with no deleted bookmarks populates subtitle");

				contextReset();
				global.testContext.localData = {
					"lastDeletedBookmarks" : [{
							parentId : "test parent id",
							url : "test deleted url"
						}
					]
				};
				messageListener(data);

			}, function () {

				assert.deepEqual(global.testContext.storageGet, [
						"lastDeletedBookmarks",
					], "Refresh with data reads storage for 'lastDeletedBookmarks'");
				assert.equal($('#btnToggleAll', tc).css('display') == 'none', false, "Refresh with data shows ToggleAll button");
				assert.equal($('#btnToggleBefore', tc).css('display') == 'none', false, "Refresh with data shows ToggleBefore button");
				assert.equal($('#btnRemove', tc).css('display') == 'none', true, "Refresh with data, but no selected items hides Remove button");
				assert.equal($('#btnUndo', tc).css('display') == 'none', false, "Refresh with data, and deleted bookmarks shows Undo button");
				assert.equal($('#divHeader', tc).text(), 'title 1', "Refresh with data shows correct title");
				assert.equal($('#divTree ul li', tc).length, 3, "Refresh with data shows correct number of items");
				$('#divTree ul li', tc).each(function (idx) {
					assert.ok($(this).html().includes(data.folder.children[idx].url), "item " + (idx + 1) + " contains the correct url");
					assert.ok($(this).text().includes(data.folder.children[idx].title), "item " + (idx + 1) + " contains the correct title");
				});

				contextReset();
				global.testContext.localData = {
					"lastDeletedBookmarks" : [{
							parentId : "test parent id",
							url : "test deleted url"
						}
					]
				};
				global.testContext.tree = [{
						children : [{
								id : "test bookmarks bar id"
							}
						]
					}
				];
				$('#btnUndo', tc).click();

			}, function () {

				assert.ok(global.testContext.storageGet.includes("lastDeletedBookmarks"), "Clicking on Undo reads storage for 'lastDeletedBookmarks'");
				assert.deepEqual(global.testContext.storageRemove, ["lastDeletedBookmarks"], "Clicking on Undo clears the storage of data");
				assert.ok(global.testContext.getTreeCalled > 0, "Clicking on Undo reads the tree of bookmarks");
				assert.deepEqual(global.testContext.bookmarksCreate,
					[{
							"parentId" : "test bookmarks bar id",
							"title" : "Undeleted items"
						}, {
							"parentId" : undefined,
							"url" : "test deleted url"
						}
					], "Clicking on Undo creates a new bookmark folder and restores the bookmark");
				assert.deepEqual(global.testContext.notificationsCreate, [{
							"iconUrl" : "bigIcon.png",
							"message" : "Parent bookmarks are missing, copying all in a new folder",
							"title" : "Siderite's Bookmark Explorer",
							"type" : "basic"
						}, {
							"iconUrl" : "bigIcon.png",
							"message" : "Bookmarks restored",
							"title" : "Siderite's Bookmark Explorer",
							"type" : "basic"
						}
					], "Clicking on Undo creates a notification that bookmarks have been restored");

				contextReset();
				global.testContext.tree = {
					"children" : [{
							"id" : "test id 1",
							"title" : "prev title",
							"url" : "prev url"
						}, {
							"id" : "test id 2",
							"title" : "title 2",
							"url" : "test url"
						}, {
							"id" : "test id 3",
							"title" : "next title",
							"url" : "next url"
						}
					],
					"title" : "title 1"
				};
				$('#divTree ul li input', tc).eq(1).click();

				assert.equal($('#btnRemove', tc).css('display') == 'none', false, "Clicking on a checkbox shows btnRemove");
				$('#btnRemove', tc).click();

			}, function () {
				assert.ok(global.testContext.getTreeCalled > 0, "Clicking on Delete reads the tree of bookmarks");
				assert.deepEqual(global.testContext.bookmarksRemove, [
						"test id 2"
					], "Clicking on Delete removes selected bookmarks");
				assert.deepEqual(global.testContext.storageSet, [{
							"lastDeletedBookmarks" : [{
									"id" : "test id 2",
									"title" : "title 2",
									"url" : "test url"
								}
							]
						}
					], "Clicking on Delete sets storage for 'lastDeletedBookmarks'");

				contextReset();
				$('#btnToggleAll', tc).click();

			}, function () {
				var inputs = $('#divTree input', tc);
				var x = [];
				inputs.each(function (idx) {
					if ($(this).is(':checked')) {
						x.push(idx);
					}
				});
				assert.deepEqual(x, [0, 1], "Toggle All button toggles all inputs");

				inputs.eq(1).parent().addClass('selected');

				$('#btnToggleBefore', tc).click();

			}, function () {
				var inputs = $('#divTree input', tc);
				var x = [];
				inputs.each(function (idx) {
					if ($(this).is(':checked')) {
						x.push(idx);
					}
				});
				assert.deepEqual(x, [1], "Toggle Before button toggles all inputs before the selected item");
			}, function () {
				ApiWrapper.getIconForUrl = old;
				a();
			});
		});
		$('body').append(scr);
		scr.attr('src', '../manage.js');

	})();

});