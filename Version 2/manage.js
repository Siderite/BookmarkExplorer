(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

	var currentData;

	$(function () {

		var api = new ApiWrapper(chrome);

		api.getBackgroundPage().then(function (bgPage) {

			var app = bgPage.app;

			var header = $('#spnTitle', context);
			var imgMenu = $('#imgMenu', context);
			var imgToggleAll = $('#imgToggleAll', context);
			var imgToggleBefore = $('#imgToggleBefore', context);
			var imgSelectDuplicates = $('#imgSelectDuplicates', context);
			var subheader = $('#divSubheader', context);
			var counts = $('#divCounts', context);
			var tree = $('#divTree', context);
			var menu = $('#ulMenu', context);
			var liRemoveBookmarks = $('li[data-command=delete]', menu);
			var liMoveToEndBookmarks = $('li[data-command=moveToEnd]', menu);
			var liMoveToStartBookmarks = $('li[data-command=moveToStart]', menu);
			var liManageDeleted = $('li[data-command=restore]', menu);
			var copyPaste = $('#divCopyPaste', context);
			var divFilter = $('#divFilter', context);
			var spnHoldFolder = $('#spnHoldFolder', context);
			var chkHoldFolder = $('#chkHoldFolder', context);

			divFilter.find('img').click(function () {
				divFilter.find('input').val('').trigger('change');
			});

			tree.listable({
				items : 'li>div:has(a)',
				filter : divFilter.find('input'),
				isEnabled : function () {
					return !menu.is(':visible') && !copyPaste.is(':visible');
				},
				findCurrent : function (items) {
					var index = 0;
					items.each(function (idx) {
						if ($(this).is('.selected')) {
							index = idx;
							return false;
						}
					});
					return index;
				}
			}).on('filter', function () {
				refreshMenuOptions(true);
			});

			api.onMessage(function (data) {
				if (data == 'current') {
					refreshFromCurrent();
					return;
				}
				if (!chkHoldFolder.is(':checked')) {
					refresh(data);
					return;
				}
				if (currentData && currentData.folder && data && data.folder && currentData.folder.id == data.folder.id) {
					refresh(data);
				} else {
					refreshFromCurrent();
				}
			});

			function refreshFromCurrent() {
				if (!currentData || !currentData.current) {
					refresh();
				} else {
					app.getInfo(currentData.current.url).then(function (data) {
						app.handleDuplicates(data, null).then(refresh);
					});
				}
			}

			var last = 0;

			function refresh(data) {
				var sdata = data ? JSON.stringify(data) : null;
				if (sdata == last)
					return;
				last = sdata;
				currentData = data;
				$(context).trigger('refresh');
				var checkData = {};
				tree.find('input[type=checkbox]').each(function () {
					var id = $(this).data('id');
					if (id) {
						var checked = $(this).prop('checked');
						checkData[id] = checked;
					}
				});
				divFilter.hide();
				tree.empty();
				if (!data || !data.folder) {
					header.text('Bookmark for the URL not found');
					subheader.text('Move to a tab that has been bookmarked to populate this page.');
					refreshMenuOptions();
					return;
				}
				divFilter.show();
				header.text(data.folder.title);
				subheader.empty();
				createTree(data.folder, checkData);
				tree.find('input[type=checkbox]').click(function() {
					refreshMenuOptions(true);
				});
				api.getUrlComparisonSchema().then(function (schema) {
					var urlOptions = ApiWrapper.getUrlOptions(data.current.url,schema);
					tree.find('a').each(function () {
						var anchorUrlOptions = ApiWrapper.getUrlOptions($(this).attr('href'),schema);
						if (ApiWrapper.compareUrlOptions(anchorUrlOptions, urlOptions).different)
							return;

						var par = $(this).parent();
						par.addClass('selected');
					});
					tree.find('.selected:visible').bringIntoView({
						parent : tree
					});
					tree.trigger('filter');
				});
			}

			function createTree(folder, checkData) {
				var ul = $('<ul></ul>').appendTo(tree);
				folder.children.forEach(function (child) {
					$('<li></li>')
					.append(createItem(child, checkData))
					.appendTo(ul);
				});
			}

			function createItem(itm, checkData) {
				var elem = $('<div></div>');
				if (itm.url) {
					$('<a></a>')
					.text(itm.title || itm.url)
					.prepend($('<img/>').addClass('favicon').hideOnError().attr('src', ApiWrapper.getIconForUrl(itm.url)))
					.attr('href', itm.url || '#')
					.attr('target', '_blank')
					.appendTo(elem);
					var chk = $('<input />')
						.attr('type', 'checkbox')
						.val(itm.id)
						.attr('title', 'Mark for delete/move etc.')
						.click(function () {
							$('div.current', tree).removeClass('current');
							$(this).parents('div:first').addClass('current');
						})
						.appendTo(elem);
					chk.data('id', itm.id);
					if (checkData && checkData[itm.id]) {
						chk.prop('checked', true);
					}
					elem.click(function (ev) {
						if (!chk.is(ev.target)) {
							chk.click();
						}
					});
				} else {
					$('<span></span>')
					.addClass('subfolder')
					.text(itm.title)
					.prepend($('<img/>').attr('src', 'folder.png'))
					.appendTo(elem);
				}
				return elem;
			}
			function anyDuplicates(items, schema) {
				var options = items.map(function(itm) { return ApiWrapper.getUrlOptions(itm.url,schema); });
				for (var i = 0; i < options.length; i++) {
					for (var j = 0; j < i; j++) {
						if (!ApiWrapper.compareUrlOptions(options[i].url, options[j].url).different) {
							return true;
						}
					}
				}
				return false;
			}

			function refreshMenuOptions(ignoreDuplicates) {
				api.getUrlComparisonSchema().then(function (schema) {
					var hasData = !!(currentData && currentData.folder);
					var hasDuplicates = false;
					if (!ignoreDuplicates && hasData) {
						hasDuplicates = anyDuplicates(currentData.folder.children, schema);
					}
					imgToggleAll.toggleClass('visible',hasData);
					imgToggleBefore.toggleClass('visible',hasData);
					imgSelectDuplicates.toggleClass('visible',hasData && hasDuplicates);
					spnHoldFolder.toggle(hasData);
					var ul = tree.find('>ul');
					var checkedInputs = ul.find('input:nothidden:checked');
					liRemoveBookmarks.toggle(!!checkedInputs.length);
					liMoveToEndBookmarks.toggle(!!checkedInputs.length);
					liMoveToStartBookmarks.toggle(!!checkedInputs.length);

					api.getDeletedBookmarks().then(function (bookmarks) {
						liManageDeleted.toggle(!!(bookmarks && bookmarks.length));
					});

					refreshCounts();
				});
			}

			function refreshCounts() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input:nothidden');
				var checkedInputs = ul.find('input:nothidden:checked');
				counts.find('span').text(inputs.length
					 ? checkedInputs.length + '/' + inputs.length
					 : '');
			}

			function copyURLsToClipboard() {
				var list = [];
				tree.find('>ul input:nothidden:checked').closest('li').find('a[href]:nothidden')
					.each(function () {
						var href = $(this).attr('href');
						list.push(href);
					});
				if (!list.length) {
					api.notify('No items checked!');
					return;
				}
				var data = list.join('\r\n');
				var ta = copyPaste.show().find('textarea').val(data);
				copyPaste.find('#btnOK').hide();
				setTimeout(function () {
					ta.focus();
					ta.select();
				}, 1);
			}

			function importLinks(text) {
				var links = text.split(/[\r\n]+/).map(function (url) {
						return url.replace(/^\s+/, '').replace(/\s+$/, '');
					}).filter(function (url) {
						return /^\w+:\/\//.test(url);
					});
				if (!links.length) {
					api.notify('Nothing to import!');
					return;
				}
				api.getBookmarksBar().then(function (bar) {
					api.createBookmarks({
						title : 'Imported items in the Bookmarks bar',
						parentId : bar.id
					}).then(function (parent) {
						var bookmarks = links.map(function (lnk) {
								return {
									parentId : parent.id,
									url : lnk,
									title : lnk
								};
							});
						api.createBookmarks(bookmarks);
						api.notify('Bookmarks imported');
					});
				});
			}

			function pasteURLsFromClipboard() {
				var ta = copyPaste.show().find('textarea').val('');
				copyPaste.find('#btnOK').off().show()
				.text('Import')
				.click(function () {
					var text = ta.val();
					if (!text) {
						api.notify('Nothing to import!');
						return;
					}
					importLinks(text);
					copyPaste.hide();
				});
				setTimeout(function () {
					ta.focus();
					ta.select();
				}, 1);
			}

			copyPaste
				.find('#btnClose').click(function () {
					copyPaste.hide();
				});
			copyPaste
				.on('keyup',function(ev) {
					if (ev.which == 27) {
						copyPaste.hide();
					}
				});

			menu.contextMenu({
				anchor : imgMenu,
				onOpen : function() { refreshMenuOptions(true); },
				executeCommand : executeMenuCommand
			});

			function executeMenuCommand(command) {
				switch (command) {
				case 'copy':
					copyURLsToClipboard();
					break;
				case 'paste':
					pasteURLsFromClipboard();
					break;
				case 'delete':
					removeBookmarks();
					break;
				case 'restore':
					app.openDeleted();
					break;
				case 'settings':
					app.openSettings();
					break;
				case 'moveToEnd':
					moveToEnd();
					break;
				case 'moveToStart':
					moveToStart();
					break;
				}
			}

			imgToggleAll.click(toggleAll);
			imgToggleBefore.click(toggleBefore);
			imgSelectDuplicates.click(selectDuplicates);

			function toggleAll(val) {
				var ul = tree.find('>ul');
				if (typeof(value)=='undefined') {
					val = 0;
					ul.find('>li>div:nothidden>input').each(function () {
						val += ($(this).is(':checked') ? 1 : -1);
					});
					val = val < 0;
				}
				ul.find('>li>div:nothidden>input').prop('checked', val);
				refreshMenuOptions(true);
			}

			function toggleBefore() {
				var ul = tree.find('>ul');
				var val = 0;
				var chks = $();
				ul.find('>li>div:nothidden').each(function (idx) {
					var chk = $('>input', this);
					if ($(this).is('.selected')) {
						return false;
					}
					val += (chk.is(':checked') ? 1 : -1);
					chks = chks.add(chk);
				});
				val = val < 0;
				chks.prop('checked', val);
				refreshMenuOptions(true);
			}

			function selectDuplicates() {
				api.getUrlComparisonSchema().then(function (schema) {
					var ul = tree.find('>ul');
					var options = [];
					ul.find('>li>div:nothidden').each(function () {
						var a = $('a', this);
						var chk = $('input', this);
						var url = a.attr('href');
						var checked = false;
						var urlOptions=ApiWrapper.getUrlOptions(url,schema);
						options.forEach(function (opt) {
							if (!ApiWrapper.compareUrlOptions(opt, urlOptions).different) {
								checked = true;
								return false;
							}
						});
						chk.prop('checked', checked);
						options.push(urlOptions);
					});
					refreshMenuOptions(true);
				});
			}

			function removeBookmarks() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input:nothidden:checked');
				if (!inputs.length)
					return;
				if (!confirm('Are you sure you want to delete ' + inputs.length + ' bookmarks?'))
					return;
				var ids = []
				inputs.each(function () {
					var id = $(this).val();
					if (id) {
						ids.push({
							id : id,
							input : this
						});
					}
				});
				api.getBookmarksByIds(ids.map(function (p) {
						return p.id;
					})).then(function (bookmarks) {
					api.getSettings().then(function (settings) {
						var f = function () {
							var k = ids.length;
							ids.forEach(function (p) {
								api.removeBookmarksById([p.id]).then(function () {
									$(p.input).closest('li').remove();
									k--;
									if (k == 0) {
										tree.find('.selected:visible').bringIntoView({
											parent : tree
										});
										refreshMenuOptions();
									}
								});
							});
						};
						if (settings.storeAllDeletedBookmarks) {
							f();
						} else {
							api.addDeletedBookmarks(bookmarks).then(f);
						}
					});
				});
			}

			function moveToEnd() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input:nothidden:checked');
				if (!inputs.length)
					return;
				if (!confirm('Are you sure you want to move to end ' + inputs.length + ' bookmarks?'))
					return;
				var ids = []
				inputs.each(function () {
					var id = $(this).val();
					if (id) {
						ids.push({
							id : id,
							input : this
						});
					}
				});
				api.getBookmarksByIds(ids.map(function (p) {
						return p.id;
					})).then(function (bookmarks) {
						bookmarks.forEach(function(bm) {
							bm = ApiWrapper.clone(bm);
							delete bm.index;
							api.createBookmarks(bm)
							api.removeBookmarksById([bm.id]);
						});
						refreshFromCurrent();
				});
			}

			function moveToStart() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input:nothidden:checked');
				if (!inputs.length)
					return;
				if (!confirm('Are you sure you want to move to start ' + inputs.length + ' bookmarks?'))
					return;
				var ids = []
				inputs.each(function () {
					var id = $(this).val();
					if (id) {
						ids.push({
							id : id,
							input : this
						});
					}
				});
				api.getBookmarksByIds(ids.map(function (p) {
						return p.id;
					})).then(function (bookmarks) {
						bookmarks.reverse();
						bookmarks.forEach(function(bm) {
							bm = ApiWrapper.clone(bm);
							bm.index=0;
							api.createBookmarks(bm)
							api.removeBookmarksById([bm.id]);
						});
						refreshFromCurrent();
				});
			}

			refresh();

		});
	});

})(jQuery);
