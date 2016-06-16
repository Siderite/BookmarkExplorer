(function ($) {

	var global = this;
	var context = global.testContext && global.testContext.document || global.document;
	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

	var currentData;

	$(function () {

		var list = $('#divList', context);
		var header = $('#divHeader span', context);
		var menuImg = $('#divHeader img', context);
		var menu = $('#ulMenu', context);
		var liToggleAll = $('li[data-command=toggleAll]', menu);
		var liRestore = $('li[data-command=restore]', menu);
		var liClearAll = $('li[data-command=clearAll]', menu);
		var divFilter = $('#divFilter', context);

		divFilter.find('img').click(function () {
			divFilter.find('input').val('').trigger('change');
		});

		var api = new ApiWrapper(chrome);

		api.getBackgroundPage().then(function (bgPage) {

			var app = bgPage.app;

			list.listable({
				items : 'li>div:has(a)',
				filter : divFilter.find('input'),
				isEnabled : function () {
					return !menu.is(':visible');
				}
			}).on('filter', function () {
				refreshRestore();
			});

			function toggleAll(elem) {
				var inputs = elem.find('input[type=checkbox]:nothidden');
				var checked = inputs.filter(function () {
						return $(this).is(':checked');
					}).length / inputs.length >= 0.5;
				inputs.prop('checked', !checked);
				refreshRestore();
			}

			function createTree(arr, title) {
				var div = $('<div></div>').appendTo(list);
				var header = $('<div></div>')
					.addClass('treeHeader')
					.text(title || 'Unnamed')
					.click(function () {
						toggleAll(ul);
					})
					.appendTo(div);
				var ul = $('<ul></ul>').appendTo(div);
				arr.forEach(function (child) {
					$('<li></li>')
					.append(createItem(child))
					.appendTo(ul);
				});
			}

			function refreshRestore() {
				liRestore.toggle(!!list.find('input[type=checkbox]:nothidden:checked').length);
			}

			function createItem(itm) {
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
							$('div.current', list).removeClass('current');
							$(this).parents('div:first').addClass('current');
							refreshRestore();
						})
						.appendTo(elem);
					chk.data('bookmark', itm);
					elem.click(function (ev) {
						if (!chk.is(ev.target)) {
							chk.click();
						}
					});
				}
				return elem;
			}

			function executeMenuCommand(command) {
				switch (command) {
				case 'toggleAll':
					toggleAll(list);
					break;
				case 'restore':
					if (restoreBookmarks()) {
						refresh();
					}
					break;
				case 'clearAll':
					if (confirm('Are you sure you want to permanently clear all deleted bookmarks?')) {
						api.removeAllDeletedBookmarks();
						refresh();
					}
					break;
				}
			}

			var doneTimeout;
			function notifyDone() {
				if (doneTimeout)
					clearTimeout(doneTimeout);
				doneTimeout = setTimeout(function () {
						api.notify('Bookmarks restored');
						refresh();
					}, 500);
			}

			function restoreBookmarks() {
				var items = list.find('input[type=checkbox]:nothidden:checked');
				if (!confirm('Are you sure you want to restore ' + items.length + ' bookmarks?'))
					return;

				var bookmarks = [];
				list.find('ul').each(function () {
					var ul = $(this);
					items = ul.find('input[type=checkbox]:nothidden:checked');
					bookmarks = bookmarks.concat(items.get().map(function (itm) {
								return $(itm).data('bookmark');
							}));
				});

				var newFolder = false;
				var parentIds = {};
				bookmarks.forEach(function (bm) {
					if (bm.parentId)
						parentIds[bm.parentId] = true;
				});
				parentIds = Object.keys(parentIds);
				api.getBookmarksByIds(parentIds).then(function (parentBookmarks) {
					if (!parentBookmarks || parentBookmarks.filter(function (bm) {
							return !!bm;
						}).length != parentIds.length) {
						api.getBookmarksBar().then(function (bar) {
							if (!newFolder) {
								newFolder = true;
								api.notify('Some parent bookmarks are missing, restoring in new folder on the bookmarks bar.');
							}
							api.createBookmarks({
								title : 'Undeleted items',
								parentId : bar.id
							}).then(function (parent) {
								bookmarks.forEach(function (bm) {
									bm.parentId = parent.id;
								});
								var ids = bookmarks.map(function (bm) {
										return bm.id;
									});
								api.createBookmarks(bookmarks);
								api.removeDeletedBookmarksByIds(ids).then(notifyDone);
							});
						});
					} else {
						var ids = bookmarks.map(function (bm) {
								return bm.id;
							});
						api.createBookmarks(bookmarks).then(function () {
							api.removeDeletedBookmarksByIds(ids).then(notifyDone);
						});
					}
				});
				return true;
			}

			menu.contextMenu({
				anchor : menuImg,
				executeCommand : executeMenuCommand
			});

			function refresh() {
				$(context).trigger('refresh');
				list.empty();
				api.getDeletedBookmarks().then(function (bookmarks) {
					if (!bookmarks || !bookmarks.length) {
						menuImg.hide();
						liToggleAll.hide();
						liRestore.hide();
						liClearAll.hide();
						header.text('No deleted bookmarks found');
						divFilter.hide();
						return;
					}
					menuImg.show();
					liToggleAll.show();
					liRestore.hide();
					liClearAll.show();
					divFilter.show();
					header.text('Deleted bookmarks');
					bookmarks.reverse().forEach(function (bms,idx) {
						api.getBookmarksByIds(bms.map(function (bm) {
								return bm.parentId;
							})).then(function (parents) {
							var title = parents.length ? parents[0].title : 'Unknown folder';
							createTree(bms, title);
							if (idx==0) list.trigger('filter');
						});
					})
					
				});
			}

			var refreshTimeout=null;
			if (api.onRemovedBookmark) {
				api.onRemovedBookmark(function() {
					if (refreshTimeout) clearTimeout(refreshTimeout);
					refreshTimeout=setTimeout(refresh,100);
				});
			}
			refresh();

		});
	});

})(jQuery);