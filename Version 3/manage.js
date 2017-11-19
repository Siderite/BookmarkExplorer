(function($) {

    const global = this;
    const context = global.testContext && global.testContext.document || global.document;
    const chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
    const confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

    let currentData;

    $(() => {

        const api = new ApiWrapper(chrome);

        api.getBackgroundPage().then(bgPage => {

            const app = bgPage.app;

            const header = $('#spnTitle', context);
            const imgMenu = $('#imgMenu', context);
            const imgToggleAll = $('#imgToggleAll', context);
            const imgToggleBefore = $('#imgToggleBefore', context);
            const imgSelectDuplicates = $('#imgSelectDuplicates', context);
            const subheader = $('#divSubheader', context);
            const counts = $('#divCounts', context);
            const tree = $('#divTree', context);
            const menu = $('#ulMenu', context);
            const liRemoveBookmarks = $('li[data-command=delete]', menu);
            const liMoveToEndBookmarks = $('li[data-command=moveToEnd]', menu);
            const liMoveToStartBookmarks = $('li[data-command=moveToStart]', menu);
            const liManageDeleted = $('li[data-command=restore]', menu);
            const copyPaste = $('#divCopyPaste', context);
            const divFilter = $('#divFilter', context);
            const spnHoldFolder = $('#spnHoldFolder', context);
            const chkHoldFolder = $('#chkHoldFolder', context);

            divFilter.find('img').click(() => {
                divFilter.find('input').val('').trigger('change');
            });

            tree.listable({
                items: 'li>div:has(a)',
                filter: divFilter.find('input'),
                isEnabled() {
                    return !menu.is(':visible') && !copyPaste.is(':visible');
                },
                findCurrent(items) {
                    let index = 0;
                    items.each(function(idx) {
                        if ($(this).is('.selected')) {
                            index = idx;
                            return false;
                        }
                    });
                    return index;
                }
            }).on('filter', () => {
                refreshMenuOptions(true);
            });

            api.onMessage(data => {
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
                    app.getInfo(currentData.current.url).then(data => {
                        app.handleDuplicates(data, null).then(refresh);
                    });
                }
            }

            let last = 0;

            function refresh(data) {
                const sdata = data ? JSON.stringify(data) : null;
                if (sdata == last)
                    return;
                last = sdata;
                currentData = data;
                $(context).trigger('refresh');
                const checkData = {};
                tree.find('input[type=checkbox]').each(function() {
                    const id = $(this).data('id');
                    if (id) {
                        const checked = $(this).prop('checked');
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
                refreshMenuOptions();
                divFilter.show();
                header.text(data.folder.title);
                subheader.empty();
                createTree(data.folder, checkData);
                tree.find('input[type=checkbox]').click(() => {
                    refreshMenuOptions(true);
                });
                api.getUrlComparisonSchema().then(schema => {
                    const urlOptions = ApiWrapper.getUrlOptions(data.current.url, schema);
                    tree.find('a').each(function() {
                        const anchorUrlOptions = ApiWrapper.getUrlOptions($(this).attr('href'), schema);
                        if (ApiWrapper.compareUrlOptions(anchorUrlOptions, urlOptions).different)
                            return;

                        const par = $(this).parent();
                        par.addClass('selected');
                    });
                    tree.find('.selected:visible').bringIntoView({
                        parent: tree
                    });
                    tree.trigger('filter');
                });
            }

            function createTree(folder, checkData) {
                const ul = $('<ul></ul>').appendTo(tree);
                folder.children.forEach(child => {
                    $('<li></li>')
                        .append(createItem(child, checkData))
                        .appendTo(ul);
                });
            }

            function createItem(itm, checkData) {
                const elem = $('<div></div>');
                if (itm.url) {
                    $('<a></a>')
                        .text(itm.title || itm.url)
                        .prepend($('<img/>').addClass('favicon').hideOnError().attr('src', ApiWrapper.getIconForUrl(itm.url)))
                        .attr('href', itm.url || '#')
                        .attr('target', '_blank')
                        .appendTo(elem);
                    const chk = $('<input />')
                        .attr('type', 'checkbox')
                        .val(itm.id)
                        .attr('title', 'Mark for delete/move etc.')
                        .click(function() {
                            $('div.current', tree).removeClass('current');
                            $(this).parents('div:first').addClass('current');
                        })
                        .appendTo(elem);
                    chk.data('id', itm.id);
                    if (checkData && checkData[itm.id]) {
                        chk.prop('checked', true);
                    }
                    elem.click(ev => {
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
                const options = items.map(itm => ApiWrapper.getUrlOptions(itm.url, schema));
                for (let i = 0; i < options.length; i++) {
                    for (let j = 0; j < i; j++) {
                        if (!ApiWrapper.compareUrlOptions(options[i], options[j]).different) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function refreshMenuOptions(ignoreDuplicates) {
                api.getUrlComparisonSchema().then(schema => {
                    const hasData = !!(currentData && currentData.folder);
                    let hasDuplicates = false;
                    if (!ignoreDuplicates) {
						if (hasData) {
                        	hasDuplicates = anyDuplicates(currentData.folder.children, schema);
						}
                    	imgSelectDuplicates.toggleClass('visible', hasData && hasDuplicates);
                    }
                    imgToggleAll.toggleClass('visible', hasData);
                    imgToggleBefore.toggleClass('visible', hasData);
                    spnHoldFolder.toggle(hasData);
                    const ul = tree.find('>ul');
                    const checkedInputs = ul.find('input:nothidden:checked');
                    liRemoveBookmarks.toggle(!!checkedInputs.length);
                    liMoveToEndBookmarks.toggle(!!checkedInputs.length);
                    liMoveToStartBookmarks.toggle(!!checkedInputs.length);

                    api.getDeletedBookmarks().then(bookmarks => {
                        liManageDeleted.toggle(!!(bookmarks && bookmarks.length));
                    });

                    refreshCounts();
                });
            }

            function refreshCounts() {
                const ul = tree.find('>ul');
                const inputs = ul.find('input:nothidden');
                const checkedInputs = ul.find('input:nothidden:checked');
                counts.find('span').text(inputs.length ?
                    `${checkedInputs.length}/${inputs.length}` :
                    '');
            }

            function copyURLsToClipboard() {
                const list = [];
                tree.find('>ul input:nothidden:checked').closest('li').find('a[href]:nothidden')
                    .each(function() {
                        const href = $(this).attr('href');
                        list.push(href);
                    });
                if (!list.length) {
                    api.notify('No items checked!');
                    return;
                }
                const data = list.join('\r\n');
                const ta = copyPaste.show().find('textarea').val(data);
                copyPaste.find('#btnOK').hide();
                setTimeout(() => {
                    ta.focus();
                    ta.select();
                }, 1);
            }

            function importLinks(text) {
                const links = text.split(/[\r\n]+/).map(url => url.replace(/^\s+/, '').replace(/\s+$/, '')).filter(url => /^\w+:\/\//.test(url));
                if (!links.length) {
                    api.notify('Nothing to import!');
                    return;
                }
                api.getBookmarksBar().then(bar => {
                    api.createBookmarks({
                        title: 'Imported items in the Bookmarks bar',
                        parentId: bar.id
                    }).then(parent => {
                        const bookmarks = links.map(lnk => ({
                            parentId: parent.id,
                            url: lnk,
                            title: lnk
                        }));
                        api.createBookmarks(bookmarks);
                        api.notify('Bookmarks imported');
                    });
                });
            }

            function pasteURLsFromClipboard() {
                const ta = copyPaste.show().find('textarea').val('');
                copyPaste.find('#btnOK').off().show()
                    .text('Import')
                    .click(() => {
                        const text = ta.val();
                        if (!text) {
                            api.notify('Nothing to import!');
                            return;
                        }
                        importLinks(text);
                        copyPaste.hide();
                    });
                setTimeout(() => {
                    ta.focus();
                    ta.select();
                }, 1);
            }

            copyPaste
                .find('#btnClose').click(() => {
                    copyPaste.hide();
                });
            copyPaste
                .on('keyup', ev => {
                    if (ev.which == 27) {
                        copyPaste.hide();
                    }
                });

            menu.contextMenu({
                anchor: imgMenu,
                onOpen() {
                    refreshMenuOptions(true);
                },
                executeCommand: executeMenuCommand
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
                const ul = tree.find('>ul');
                if (typeof(value) == 'undefined') {
                    val = 0;
                    ul.find('>li>div:nothidden>input').each(function() {
                        val += ($(this).is(':checked') ? 1 : -1);
                    });
                    val = val < 0;
                }
                ul.find('>li>div:nothidden>input').prop('checked', val);
                refreshMenuOptions(true);
            }

            function toggleBefore() {
                const ul = tree.find('>ul');
                let val = 0;
                let chks = $();
                ul.find('>li>div:nothidden').each(function(idx) {
                    const chk = $('>input', this);
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
                api.getUrlComparisonSchema().then(schema => {
                    const ul = tree.find('>ul');
                    const options = [];
                    ul.find('>li>div:nothidden').each(function() {
                        const a = $('a', this);
                        const chk = $('input', this);
                        const url = a.attr('href');
                        let checked = false;
                        const urlOptions = ApiWrapper.getUrlOptions(url, schema);
                        options.forEach(opt => {
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
                const ul = tree.find('>ul');
                const inputs = ul.find('input:nothidden:checked');
                if (!inputs.length)
                    return;
                if (!confirm(`Are you sure you want to delete ${inputs.length} bookmarks?`))
                    return;
                const ids = [];
                inputs.each(function() {
                    const id = $(this).val();
                    if (id) {
                        ids.push({
                            id,
                            input: this
                        });
                    }
                });
                api.getBookmarksByIds(ids.map(p => p.id)).then(bookmarks => {
                    api.getSettings().then(settings => {
                        const f = () => {
                            let k = ids.length;
                            ids.forEach(p => {
                                api.removeBookmarksById([p.id]).then(() => {
                                    $(p.input).closest('li').remove();
                                    k--;
                                    if (k == 0) {
                                        tree.find('.selected:visible').bringIntoView({
                                            parent: tree
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
                const ul = tree.find('>ul');
                const inputs = ul.find('input:nothidden:checked');
                if (!inputs.length)
                    return;
                if (!confirm(`Are you sure you want to move to end ${inputs.length} bookmarks?`))
                    return;
                const ids = [];
                inputs.each(function() {
                    const id = $(this).val();
                    if (id) {
                        ids.push({
                            id,
                            input: this
                        });
                    }
                });
                api.getBookmarksByIds(ids.map(p => p.id)).then(bookmarks => {
                    bookmarks.forEach(bm => {
                        bm = ApiWrapper.clone(bm);
                        delete bm.index;
                        api.createBookmarks(bm)
                        api.removeBookmarksById([bm.id]);
                    });
                    refreshFromCurrent();
                });
            }

            function moveToStart() {
                const ul = tree.find('>ul');
                const inputs = ul.find('input:nothidden:checked');
                if (!inputs.length)
                    return;
                if (!confirm(`Are you sure you want to move to start ${inputs.length} bookmarks?`))
                    return;
                const ids = [];
                inputs.each(function() {
                    const id = $(this).val();
                    if (id) {
                        ids.push({
                            id,
                            input: this
                        });
                    }
                });
                api.getBookmarksByIds(ids.map(p => p.id)).then(bookmarks => {
                    bookmarks.reverse();
                    bookmarks.forEach(bm => {
                        bm = ApiWrapper.clone(bm);
                        bm.index = 0;
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