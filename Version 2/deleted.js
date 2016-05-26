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

		var api = new ApiWrapper(chrome);

		api.getBackgroundPage().then(function (bgPage) {

			var app = bgPage.app;

			var Bookmarks = {
				key : 'lastDeletedBookmarks',
				get : function () {
					return new Promise(function (resolve, reject) {
						api.getData(Bookmarks.key).then(function (arr) {
							if (!arr || !arr.bookmarks || !arr.bookmarks.length) {
								resolve(null);
							} else {
								resolve(arr.bookmarks[arr.bookmarks.length - 1]);
							}
						});
					});
				},
				getAll : function () {
					return new Promise(function (resolve, reject) {
						api.getData(Bookmarks.key).then(function (arr) {
							if (!arr || !arr.bookmarks || !arr.bookmarks.length) {
								resolve(null);
							} else {
								resolve(arr.bookmarks);
							}
						});
					});
				},
				remove : function (ids) {
					return new Promise(function (resolve, reject) {
						api.getData(Bookmarks.key).then(function (arr) {
							if (!arr || !arr.bookmarks || !arr.bookmarks.length) {
								resolve(null);
								return;
							}
							arr.bookmarks.forEach(function (bookmarks) {
								var i = 0;
								while (i < bookmarks.length) {
									if (ids.includes(bookmarks[i].id)) {
										bookmarks.splice(i, 1);
									} else {
										i++;
									}
								}
							});
							arr.bookmarks=arr.bookmarks.filter(function(bms) { return !!bms.length; });
							api.setData(Bookmarks.key, arr).then(resolve);
						});
					});
				},
				removeAll : function () {
					return new Promise(function (resolve, reject) {
						arr = {
							bookmarks : []
						};
						api.setData(Bookmarks.key, arr).then(resolve);
					});
				}
			};

			$(context).on('keydown', function (e) {
				if (menu.is(':visible'))
					return;
				switch (e.which) {
				case 38: //Up
				case 40: //Down
				case 32: //Space
					e.preventDefault();
					break;
				}

			});

			$(context).on('keyup', function (e) {
				if (menu.is(':visible'))
					return;
				var items = list.find('li>div:has(a)');
				var index = 0;
				items.each(function (idx) {
					if ($(this).is('.current')) {
						index = idx;
						return false;
					}
				});
				switch (e.which) {
				case 38: //Up
					if (index - 1 >= 0) {
						items.eq(index).removeClass('current');
						index--;
						items.eq(index).addClass('current');
						bringCurrentIntoView();
					}
					break;
				case 40: //Down
					if (index + 1 < items.length) {
						items.eq(index).removeClass('current');
						index++;
						items.eq(index).addClass('current');
						bringCurrentIntoView();
					}
					break;
				case 32: //Space
					items.eq(index).find('input[type=checkbox]').click();
					break;
				}

			});

			function bringCurrentIntoView() {
				var height = list.height();
				var current = list.find('div.current');
				var top = list.scrollTop() + current.position().top;
				if (top) {
					list.clearQueue().animate({
						scrollTop : top - height / 2
					});
				}
			}

			function toggleAll(elem) {
				var inputs = elem.find('input[type=checkbox]');
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
				liRestore.toggle(!!list.find('input[type=checkbox]:checked').length);
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
					restoreBookmarks();
					refresh();
					break;
				case 'clearAll':
					if (confirm('Are you sure you want to permanently clear all deleted bookmarks?')) {
						Bookmarks.removeAll();
						refresh();
					}
					break;
				}
			}

			var doneTimeout;
			function notifyDone() {
				if (doneTimeout) clearTimeout(doneTimeout);
				doneTimeout=setTimeout(function() {
					api.notify('Bookmarks restored');
					refresh();
				},500);
			}

			function restoreBookmarks() {
				var items = list.find('input[type=checkbox]:checked');
				if (!confirm('Are you sure you want to restore ' + items.length + ' bookmarks?'))
					return;

				var newFolder = false;
				list.find('ul').each(function () {
					var ul = $(this);
					items = ul.find('input[type=checkbox]:checked');
					var bookmarks = items.get().map(function (itm) {
							return $(itm).data('bookmark');
						});

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
									var ids=bookmarks.map(function(bm) { return bm.id; });
									api.createBookmarks(bookmarks);
									Bookmarks.remove(ids).then(notifyDone);
								});
							});
						} else {
							var ids=bookmarks.map(function(bm) { return bm.id; });
							api.createBookmarks(bookmarks).then(function () {
								Bookmarks.remove(ids).then(notifyDone);
							});
						}
					});
				});
			}

			var menuInit = false;
			function initMenu() {
				if (menuInit) return;
				menuInit = true;
				var items=menu.find('li').filter(function() { return $(this).css('display')=='none'; });
				items.show();
				menu.menu({
					select : function (ev, ui) {
						var command = $(ui.item).data('command');
						executeMenuCommand(command);
					},
					items : "> :not(.ui-widget-header)"
				}).position({
					my : "right top",
					at : "right bottom",
					of : menuImg,
					collision : 'flip'
				});
				items.hide();
			}
			$(context).click(function () {
				menu.hide();
			});
			menuImg.click(function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				if (menu.is(':visible')) {
					menu.hide();
				} else {
					initMenu();
					refreshMenuHeaders();
					menu.show();
				}
			});
			function refreshMenuHeaders() {
				$('li.ui-widget-header', menu).show().each(function () {
					var itm = $(this);
					var next = itm.next('li');
					while (next.length) {
						if (next.is('.ui-menu-item') && next.css('display') != 'none') {
							return;
						}
						if (next.is('.ui-widget-header')) {
							break;
						}
						next = next.next('li');
					}
					itm.hide();
				});
			}

			function refresh() {
				list.empty();
				Bookmarks.getAll().then(function (bookmarks) {
					if (!bookmarks) {
						menuImg.hide();
						liToggleAll.hide();
						liRestore.hide();
						liClearAll.hide();
						refreshMenuHeaders();
						header.text('No data available');
						return;
					}
					menuImg.show();
					liToggleAll.show();
					liRestore.hide();
					liClearAll.show();
					refreshMenuHeaders();
					header.text('Deleted bookmarks');
					bookmarks.reverse().forEach(function (bms) {
						api.getBookmarksByIds(bms.map(function (bm) {
								return bm.parentId;
							})).then(function (parents) {
							var title = parents.length ? parents[0].title : 'Unknown folder';
							createTree(bms, title);
						});
					})
				});
			}

			if (api.onRemovedBookmark) {
				api.onRemovedBookmark(refresh);
			}
			refresh();

		});
	});

})(jQuery);