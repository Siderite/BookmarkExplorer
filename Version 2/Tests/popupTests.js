QUnit.module("Popup.js");

QUnit.test("Popup script", function (assert) {

	var a = assert.async();

	(function () {
		var global = this;
		global.testContext = {};
		global.testContext.document = $('<div>' +
				'<div id="divFolder" title="Bookmark folder">Bookmarks</div>' +
				'<div id="divButtons">' +
				'<button id="btnPrev" title="previous bookmark">&larr;</button>' +
				'<button id="btnNext" title="next bookmark">&rarr;</button>' +
				'</div>' +
				'<button id="btnManage" title="Manage the bookmark folder of the current page">Manage</button>' +
				'</div>');
		var updatedListener;
		var currentTab = {
			url : "test url"
		};
		var currentInfo = null;
		var lastCommand;
		var bgPage = {
			app : {
				execute : function (command) {
					lastCommand = command;
				},
				getInfo : function (url) {
					return new Promise(function (resolve, reject) {
						resolve(currentInfo);
					});
				}
			}
		};
		global.testContext.chrome = {
			runtime : {
				getBackgroundPage : function (callback) {
					callback(bgPage);
				}
			},
			tabs : {
				query : function (queryInfo, callback) {
					callback([currentTab]);
				},
				onUpdated : {
					addListener : function (listener) {
						updatedListener = listener;
					}
				}
			}
		};

		var tc = global.testContext.document;
		var scr = $('<script></script>');
		scr.on('load', function () {
			assert.equal($('#btnPrev', tc).prop('disabled'), true, "Popup: Previous button disabled when no info");
			assert.equal($('#btnNext', tc).prop('disabled'), true, "Popup: Next button disabled when no info");
			assert.equal($('#btnManage', tc).prop('disabled'), false, "Popup: Manage button always enabled");

			currentInfo = {
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

			updatedListener();
			setTimeout(function () {
				assert.equal($('#btnPrev', tc).prop('disabled'), false, "Popup: Previous button not disabled when info is populated and there is a previous bookmark");
				assert.equal($('#btnNext', tc).prop('disabled'), false, "Popup: Next button not disabled when info is populated and there is a next bookmark");
				assert.equal($('#btnManage', tc).prop('disabled'), false, "Popup: Manage button always enabled");
				$('#btnPrev', tc).click();
				assert.equal(lastCommand, 'prevBookmark', "Popup: previous button calls prevBookmark");
				$('#btnNext', tc).click();
				assert.equal(lastCommand, 'nextBookmark', "Popup: next button calls prevBookmark");
				$('#btnManage', tc).click();
				assert.equal(lastCommand, 'manage', "Popup: manage button calls manage");
				a();
			}, 1);
		});
		$('body').append(scr);
		scr.attr('src', '../popup.js');

	})();

});