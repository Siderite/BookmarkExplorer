    (function ($) {

    	var global = this;
    	var context = global.testContext && global.testContext.document || global.document;
    	var chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
    	var confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

    	var currentData;

    	$(function () {

    		var api = new ApiWrapper(chrome);
    		var header = $('#divHeader span', context);
    		var menuImg = $('#divHeader img', context);
    		var subheader = $('#divSubheader', context);
    		var counts = $('#divCounts', context);
    		var tree = $('#divTree', context);
    		var buttons = $('#divButtons', context);
    		var btnToggleAll = $('#btnToggleAll', context);
    		var btnToggleBefore = $('#btnToggleBefore', context);
    		var btnRemove = $('#btnRemove', context);
    		var btnUndo = $('#btnUndo', context);
    		var menu = $('#ulMenu', context);
    		var copyPaste = $('#divCopyPaste', context);

    		$(context).on('keydown', function (e) {
    			if (menu.is(':visible') || copyPaste.is(':visible'))
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
    			if (menu.is(':visible') || copyPaste.is(':visible'))
    				return;
    			var ul = tree.find('>ul');
    			var index = ul.find('>li:has(div.current)').index();
    			if (index < 0)
    				index = 0;
    			switch (e.which) {
    			case 38: //Up
    				if (index - 1 >= 0) {
    					ul.find('>li>div').eq(index).removeClass('current');
    					index--;
    					ul.find('>li>div').eq(index).addClass('current');
    					bringCurrentIntoView();
    				}
    				break;
    			case 40: //Down
    				var total = ul.find('>li').length;
    				if (index + 1 < total) {
    					ul.find('>li>div').eq(index).removeClass('current');
    					index++;
    					ul.find('>li>div').eq(index).addClass('current');
    					bringCurrentIntoView();
    				}
    				break;
    			case 32: //Space
    				ul.find('>li').eq(index).find('input[type=checkbox]').click();
    				break;
    			}

    		});

    		api.onMessage(refresh);

    		function refresh(data) {
    			api.getData('lastDeletedBookmarks').then(function (bookmarks) {
    				if (bookmarks) {
    					btnUndo.text('Restore ' + bookmarks.length + ' bookmarks').show();
    				} else {
    					btnUndo.hide();
    				}
    			});

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
    			btnRemove.hide();
    			if (!data || !data.folder) {
    				header.text('Bookmark for the URL not found');
    				subheader.text('Move to a tab that has been bookmarked to populate this page.');
    				btnToggleAll.hide();
    				btnToggleBefore.hide();
    				btnUndo.hide();
    				refreshCounts();
    				return;
    			}
    			btnToggleAll.show();
    			btnToggleBefore.show();
    			header.text(data.folder.title);
    			subheader.empty();
    			createTree(data.folder, checkData);
    			tree.find('input[type=checkbox]').click(refreshbtnRemove);
    			tree.find('a').each(function () {
    				if (ApiWrapper.sameUrls($(this).attr('href'), data.current.url) < 2)
    					return;

    				var par = $(this).parent();
    				par.addClass('selected');
    			});
    			bringSelectedIntoView();
    			refreshCounts();
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

    		function bringSelectedIntoView() {
    			var bottom = tree.height();
    			var minTop = null;
    			var maxTop = null;
    			tree.find('div.selected').each(function () {
    				var ofs = $(this).offset();
    				if (minTop === null)
    					minTop = ofs.top;
    				if (maxTop === null || ofs.top + 25 > maxTop)
    					maxTop = ofs.top + 25;
    			});
    			if (minTop && maxTop) {
    				var y = (minTop + maxTop) / 2;
    				if (y >= bottom) {
    					tree.animate({
    						scrollTop : y - bottom / 2
    					});
    				}
    			}
    		}

    		function bringCurrentIntoView() {
    			var height = tree.height();
    			var current = tree.find('div.current');
    			var top = tree.scrollTop() + current.position().top;
    			if (top) {
    				tree.clearQueue().animate({
    					scrollTop : top - height / 2
    				});
    			}
    		}

    		function refreshbtnRemove() {
    			var ul = tree.find('>ul');
    			var checkedInputs = ul.find('input:checked');
    			btnRemove.toggle(!!checkedInputs.length);
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

    		var menuInit = false;
    		$(context).click(function () {
    			menu.hide();
    		});
    		menuImg.click(function (ev) {
    			ev.preventDefault();
    			ev.stopPropagation();
    			if (menu.is(':visible')) {
    				menu.hide();
    			} else {
    				if (!menuInit) {
    					menuInit = true;
    					menu.menu({
    						select : function (ev, ui) {
    							var command = $(ui.item).data('command');
    							switch (command) {
    							case 'copy':
    								copyURLsToClipboard();
    								break;
    							case 'paste':
    								pasteURLsFromClipboard();
    								break;
    							}
    						}
    					}).position({
    						my : "right top",
    						at : "right bottom",
    						of : menuImg,
    						collision : 'flip'
    					});

    				}
    				menu.show();
    			}
    		});

    		copyPaste.find('#btnClose').click(function () {
    			copyPaste.hide();
    		});

    		btnToggleAll.click(function () {
    			var ul = tree.find('>ul');
    			var val = ul.find('>li>div>input:checked').length < ul.find('>li>div>input:not(:checked)').length;
    			ul.find('>li>div>input').prop('checked', val);
    			refreshbtnRemove();
    		});
    		btnToggleBefore.click(function () {
    			var ul = tree.find('>ul');
    			var index = ul.find('>li:has(div.selected)').index();
    			var val = ul.find('>li>div>input:lt(' + index + '):checked').length < ul.find('>li>div>input:lt(' + index + '):not(:checked)').length;
    			ul.find('>li>div>input:lt(' + index + ')').prop('checked', val);
    			refreshbtnRemove();
    		});
    		btnRemove.click(function () {
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
    				api.setData('lastDeletedBookmarks', bookmarks).then(function () {
    					btnUndo.text('Restore ' + bookmarks.length + ' bookmarks').show();
    					ids.forEach(function (p) {
    						api.removeBookmarksById([p.id]).then(function () {
    							$(p.input).closest('li').remove();
    						});
    					});
    					refreshbtnRemove();
    				});
    			});
    		});

    		btnUndo.click(function () {
    			api.getData('lastDeletedBookmarks').then(function (bookmarks) {
    				if (!confirm('Are you sure you want to restore ' + bookmarks.length + ' bookmarks?'))
    					return;
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
    						api.notify('Parent bookmarks are missing, copying all in a new folder');
    						api.getBookmarksBar().then(function (bar) {
    							api.createBookmarks({
    								title : 'Undeleted items',
    								parentId : bar.id
    							}).then(function (parent) {
    								bookmarks.forEach(function (bm) {
    									bm.parentId = parent.id;
    								});
    								api.createBookmarks(bookmarks);
    								api.notify('Bookmarks restored');
    								api.removeData('lastDeletedBookmarks').then(function () {
    									btnUndo.hide();
    									refresh(currentData);
    								});
    							});
    						});
    					} else {
    						api.createBookmarks(bookmarks).then(function () {
    							api.notify('Bookmarks restored');
    							api.removeData('lastDeletedBookmarks').then(function () {
    								btnUndo.hide();
    								refresh(currentData);
    							});
    						});
    					}
    				});
    			});
    		});
    		refresh();

    	});

    })(jQuery);