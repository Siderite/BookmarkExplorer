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

			var header = $('#divHeader span', context);
			var menuImg = $('#divHeader img', context);
			var subheader = $('#divSubheader', context);
			var counts = $('#divCounts', context);
			var tree = $('#divTree', context);
			var menu = $('#ulMenu', context);
			var liToggleAll = $('li[data-command=toggleAll]', menu);
			var liToggleBefore = $('li[data-command=toggleBefore]', menu);
			var liRemoveBookmarks = $('li[data-command=delete]', menu);
			var liManageDeleted = $('li[data-command=restore]', menu);
			var copyPaste = $('#divCopyPaste', context);

			tree.listable({
				items : 'li>div:has(a)',
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
			});

			api.onMessage(refresh);

			function refreshFromCurrent() {
				if (!currentData || !currentData.current) {
					refresh();
				} else {
					app.getInfo(currentData.current.url).then(refresh);
				}
			}

			function refresh(data) {
				$(context).trigger('refresh');
				var checkData = {};
				tree.find('input[type=checkbox]').each(function () {
					var id = $(this).data('id');
					if (id) {
						var checked = $(this).prop('checked');
						checkData[id] = checked;
					}
				});
				currentData = data;
				tree.empty();
				if (!data || !data.folder) {
					header.text('Bookmark for the URL not found');
					subheader.text('Move to a tab that has been bookmarked to populate this page.');
					refreshMenuOptions();
					return;
				}
				header.text(data.folder.title);
				subheader.empty();
				createTree(data.folder, checkData);
				tree.find('input[type=checkbox]').click(refreshMenuOptions);
				tree.find('a').each(function () {
					if (ApiWrapper.sameUrls($(this).attr('href'), data.current.url) < 2)
						return;

					var par = $(this).parent();
					par.addClass('selected');
				});
				tree.find('.selected').bringIntoView({
					parent : tree
				});
				refreshMenuOptions();
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
					.prepend($('<img/>').attr('src', ApiWrapper.getIconForUrl(itm.url)))
					.attr('href', itm.url || '#')
					.attr('target', '_blank')
					.appendTo(elem);
					var chk = $('<input />')
						.attr('type', 'checkbox')
						.val(itm.id)
						.attr('title', 'Mark for delete')
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

			function refreshMenuOptions() {
				var hasData = !!(currentData && currentData.folder);
				liToggleAll.toggle(hasData);
				liToggleBefore.toggle(hasData);
				var ul = tree.find('>ul');
				var checkedInputs = ul.find('input:checked');
				liRemoveBookmarks.toggle(!!checkedInputs.length);

				api.getDeletedBookmarks().then(function (bookmarks) {
					liManageDeleted.toggle(!!(bookmarks && bookmarks.length));
				});

				refreshCounts();
			}

			function refreshCounts() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input');
				var checkedInputs = ul.find('input:checked');
				counts.find('span').text(inputs.length
					 ? checkedInputs.length + '/' + inputs.length
					 : '');
			}

			function copyURLsToClipboard() {
				var list = [];
				tree.find('>ul a[href]').each(function () {
					var href = $(this).attr('href');
					list.push(href);
				});
				if (!list.length) {
					api.notify('Nothing to copy!');
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

			copyPaste.find('#btnClose').click(function () {
				copyPaste.hide();
			});

			menu.contextMenu({
				anchor : menuImg,
				onOpen : refreshMenuOptions,
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
				case 'toggleAll':
					toggleAll();
					break;
				case 'toggleBefore':
					toggleBefore();
					break;
				case 'delete':
					removeBookmarks();
					break;
				case 'restore':
					app.openDeleted();
					break;
				}
			}

			function toggleAll() {
				var ul = tree.find('>ul');
				var val = ul.find('>li>div>input:checked').length < ul.find('>li>div>input:not(:checked)').length;
				ul.find('>li>div>input').prop('checked', val);
				refreshMenuOptions();
			}

			function toggleBefore() {
				var ul = tree.find('>ul');
				var index = ul.find('>li:has(div.selected)').index();
				var val = ul.find('>li>div>input:lt(' + index + '):checked').length < ul.find('>li>div>input:lt(' + index + '):not(:checked)').length;
				ul.find('>li>div>input:lt(' + index + ')').prop('checked', val);
				refreshMenuOptions();
			}

			function removeBookmarks() {
				var ul = tree.find('>ul');
				var inputs = ul.find('input:checked');
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
					api.addDeletedBookmarks(bookmarks).then(function () {
						var k = ids.length;
						ids.forEach(function (p) {
							api.removeBookmarksById([p.id]).then(function () {
								$(p.input).closest('li').remove();
								k--;
								if (k == 0)
									refreshMenuOptions();
							});
						});
					});
				});
			}

			refresh();

		});
	});

})(jQuery);