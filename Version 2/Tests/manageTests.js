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
		global.testContext.document = $('<section>'+
	'<div id="divHeader"><span id="spnTitle"></span><span id="spnButtons"><img id="imgToggleBefore" title="Toggle all before current" src="toggleBefore.png"/><img id="imgToggleAll" title="Toggle all before current"src="toggleAll.png"/><img id="imgMenu"  title="Menu" src="menu.png"/></span></div>'+
	'<div id="divSubheader"></div>'+
	'<div id="divFilter"><label for="txtFilter">Filter:</label><input id="txtFilter" /><img src="clearText.png" title="clear filter"/></div>'+
	'<div id="divCounts"><span></span></div>'+
	'<div id="divTree"></div>'+
	'<ul id="ulMenu">'+
	'   <li class="ui-widget-header">Actions</li>'+
	'	<li data-command="delete">Delete selected</li>'+
	'	<li class="ui-widget-header">Pages</li>'+
	'	<li data-command="restore">Restore deleted bookmarks</li>'+
	'	<li data-command="settings">Settings</li>'+
	'	<li class="ui-widget-header">Import/Export</li>'+
	'	<li data-command="copy">Copy URLs to clipboard</li>'+
	'	<li data-command="paste">Import URLs</li>'+
	'</ul></section>');
		function contextReset() {
			global.testContext.tree = [];
			global.testContext.currentData = null;
			global.testContext.localData = null;
			//global.testContext.storageRemove = [];
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
						global.testContext.messageListener = listener;
					}
				},
				getBackgroundPage : function (callback) {
					callback({
						app : {
							getInfo : function () {
								return Promise.resolve(global.testContext.currentData);
							}
						}
					});
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
					}
					/*,
					remove : function (key, callback) {
					global.testContext.storageRemove.push(key);
					callback({});
					}*/
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

			$('#divHeader img', tc).click(); // initialize menu

			assert.ok(global.testContext.messageListener && typeof(global.testContext.messageListener) == 'function', "Initial load binds a listener to onMessage");

			assert.equal($('#imgToggleAll', tc).css('display') == 'none', true, "Initial load with no data hides ToggleAll button");
			assert.equal($('#imgToggleBefore', tc).css('display') == 'none', true, "Initial load with no data hides ToggleBefore button");
			assert.equal($('li[data-command=delete]', tc).css('display') == 'none', true, "Initial load with no data hides Remove button");
			assert.equal($('li[data-command=restore]', tc).css('display') == 'none', true, "Initial load with no deleted bookmarks hides Undo button");
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
			global.testContext.messageListener(data);

			stringFunctions(function () {
				assert.equal($('#imgToggleAll', tc).css('display') == 'none', false, "Refresh with data shows ToggleAll button");
				assert.equal($('#imgToggleBefore', tc).css('display') == 'none', false, "Refresh with data shows ToggleBefore button");
				assert.equal($('li[data-command=delete]', tc).css('display') == 'none', true, "Refresh with data, but no selected items hides Remove button");
				assert.equal($('li[data-command=restore]', tc).css('display') == 'none', true, "Refresh with data, but no deleted bookmarks hides Undo button");
				assert.equal($('#divHeader', tc).text(), 'title 1', "Refresh with data shows correct title");
				assert.equal($('#divTree ul li', tc).length, 3, "Refresh with data shows correct number of items");
				$('#divTree ul li', tc).each(function (idx) {
					assert.ok($(this).html().includes(data.folder.children[idx].url), "item " + (idx + 1) + " contains the correct url");
					assert.ok($(this).text().includes(data.folder.children[idx].title), "item " + (idx + 1) + " contains the correct title");
				});

				contextReset();
				global.testContext.messageListener(null);
			}, function () {

				assert.equal($('#imgToggleAll', tc).css('display') == 'none', true, "Refresh with no data hides ToggleAll button");
				assert.equal($('#imgToggleBefore', tc).css('display') == 'none', true, "Refresh with no data hides ToggleBefore button");
				assert.equal($('li[data-command=delete]', tc).css('display') == 'none', true, "Refresh with no data hides Remove button");
				assert.equal($('li[data-command=restore]', tc).css('display') == 'none', true, "Refresh with no deleted bookmarks hides Undo button");
				assert.equal($('#divHeader', tc).text(), 'Bookmark for the URL not found', "Refresh with no deleted bookmarks populates title");
				assert.equal($('#divSubheader', tc).text(), 'Move to a tab that has been bookmarked to populate this page.', "Refresh with no deleted bookmarks populates subtitle");

				contextReset();
				global.testContext.localData = {
					"lastDeletedBookmarks" : {
						bookmarks : [[{
									parentId : "test parent id",
									url : "test deleted url"
								}
							]]
					}
				};
				global.testContext.messageListener(data);

			}, function () {

				assert.deepEqual(global.testContext.storageGet, [
  "lastDeletedBookmarks",
  "settings"
], "Refresh with data reads storage for 'lastDeletedBookmarks'");
				assert.equal($('#imgToggleAll', tc).css('display') == 'none', false, "Refresh with data shows ToggleAll button");
				assert.equal($('#imgToggleBefore', tc).css('display') == 'none', false, "Refresh with data shows ToggleBefore button");
				assert.equal($('li[data-command=delete]', tc).css('display') == 'none', true, "Refresh with data, but no selected items hides Remove button");
				assert.equal($('li[data-command=restore]', tc).css('display') == 'none', false, "Refresh with data, and deleted bookmarks shows Undo button");
				assert.equal($('#divHeader', tc).text(), 'title 1', "Refresh with data shows correct title");
				assert.equal($('#divTree ul li', tc).length, 3, "Refresh with data shows correct number of items");
				$('#divTree ul li', tc).each(function (idx) {
					assert.ok($(this).html().includes(data.folder.children[idx].url), "item " + (idx + 1) + " contains the correct url");
					assert.ok($(this).text().includes(data.folder.children[idx].title), "item " + (idx + 1) + " contains the correct title");
				});

				contextReset();
				global.testContext.localData = {
					"lastDeletedBookmarks" : {
						bookmarks : [[{
									parentId : "test parent id",
									url : "test deleted url"
								}
							]]
					}
				};
				global.testContext.tree = [{
						children : [{
								id : "test bookmarks bar id"
							}
						]
					}
				];

				global.testContext.messageListener(data);
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
			}, function () {

				assert.equal($('li[data-command=delete]', tc).css('display') == 'none', false, "Clicking on a checkbox shows Remove");
				$('li[data-command=delete]', tc).click();

			}, function () {
				assert.ok(global.testContext.getTreeCalled > 0, "Clicking on Delete reads the tree of bookmarks");
				assert.deepEqual(global.testContext.bookmarksRemove, [
						"test id 2"
					], "Clicking on Delete removes selected bookmarks");
				//assert.deepEqual(global.testContext.storageSet, [{"lastDeletedBookmarks":{"bookmarks":[[{"id":"test id 2","title":"title 2","url":"test url"}]]}}], "Clicking on Delete sets storage for 'lastDeletedBookmarks'");

				contextReset();
				$('#imgToggleAll', tc).click();

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

				$('#imgToggleBefore', tc).click();

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