(function($) {

    const global = this;
    const context = global.testContext && global.testContext.document || global.document;
    const chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
    const confirm = global.testContext && global.testContext.confirm ? global.testContext.confirm : global.confirm;

    const api = new ApiWrapper(chrome);

    $(() => {
        const aShortcuts = $('#aShortcuts', context);
        const divShortcuts = $('#divShortcuts', context);
        const divShortcutsChrome = $('#divShortcutsChrome', context);
        const divShortcutsFirefox = $('#divShortcutsFirefox', context);
        const divShortcutsOpera = $('#divShortcutsOpera', context);
        const chkPrevNextContext = $('#chkPrevNextContext', context);
        const chkSkipButton = $('#chkSkipButton', context);
        const chkManageContext = $('#chkManageContext', context);
        const chkReadLaterContext = $('#chkReadLaterContext', context);
        const chkEnableBookmarkPage = $('#chkEnableBookmarkPage', context);
        const chkConfirmBookmarkPage = $('#chkConfirmBookmarkPage', context);
        const liReadLaterFolderName = $('#liReadLaterFolderName', context);
        const txtReadLaterPageTimeout = $('#txtReadLaterPageTimeout', context);
        const chkStoreAllDeletedBookmarks = $('#chkStoreAllDeletedBookmarks', context);
        const txtAutoClearDeleted = $('#txtAutoClearDeleted', context);
        const btnAddFolderName = $('#btnAddFolderName', context);
        const chkPreloadNext = $('#chkPreloadNext', context);
        const chkShowCurrentIndex = $('#chkShowCurrentIndex', context);
        const chkDuplicateNotifications = $('#chkDuplicateNotifications', context);
        const chkSkipPageNotBookmarkedOnNavigate = $('#chkSkipPageNotBookmarkedOnNavigate', context);
        const txtCustomUrlComparison = $('#txtCustomUrlComparison', context);
        const txtCustomUrlComparisonInvalid = $('#txtCustomUrlComparisonInvalid', context);
        const chkCleanUrls = $('#chkCleanUrls', context);

        api.getSettings().then(settings => {
            chkPrevNextContext
                .prop('checked', settings.prevNextContext)
                .click(function() {
                    settings.prevNextContext = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkSkipButton
                .prop('checked', !settings.hideSkipButton)
                .click(function() {
                    settings.hideSkipButton = !$(this).prop('checked');
                    api.setSettings(settings);
                });
            chkManageContext
                .prop('checked', settings.manageContext)
                .click(function() {
                    settings.manageContext = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkReadLaterContext
                .prop('checked', settings.readLaterContext)
                .click(function() {
                    settings.readLaterContext = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkEnableBookmarkPage
                .prop('checked', settings.enableBookmarkPage)
                .click(function() {
                    settings.enableBookmarkPage = $(this).prop('checked');
                    chkConfirmBookmarkPage.prop('disabled', !settings.enableBookmarkPage);
                    api.setSettings(settings);
                });
            chkConfirmBookmarkPage
                .prop('disabled', !settings.enableBookmarkPage)
                .prop('checked', settings.confirmBookmarkPage)
                .click(function() {
                    settings.confirmBookmarkPage = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkShowCurrentIndex
                .prop('checked', settings.showCurrentIndex)
                .click(function() {
                    settings.showCurrentIndex = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkDuplicateNotifications
                .prop('checked', settings.showDuplicateNotifications)
                .click(function() {
                    settings.showDuplicateNotifications = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkSkipPageNotBookmarkedOnNavigate
                .prop('checked', settings.skipPageNotBookmarkedOnNavigate)
                .click(function() {
                    settings.skipPageNotBookmarkedOnNavigate = $(this).prop('checked');
                    api.setSettings(settings);
                });
            chkCleanUrls
                .prop('checked', settings.cleanUrls)
                .click(function() {
                    settings.cleanUrls = $(this).prop('checked');
                    api.setSettings(settings);
                });

            let names = (settings.readLaterFolderName || 'Read Later').split(/,/);
            names = [...new Set(names)];

            liReadLaterFolderName
                .on('keyup paste', () => {
                    const names = [];
                    liReadLaterFolderName.find('input[type=text]').each(function() {
                        const val = $(this).val().trim();
                        if (val) names.push(val);
                    });
                    settings.readLaterFolderName = names.join(',');
                    api.setSettings(settings);
                });


            const fInsertName = name => {
                $('<input type="text"/>')
                    .val(name)
                    .on('blur focusout', () => {
                        const empty = [];
                        const inputs = liReadLaterFolderName.find('input[type=text]');
                        inputs.each(function() {
                            const val = $(this).val().trim();
                            if (!val) empty.push($(this));
                        });
                        if (empty.length && empty.length == inputs.length) {
                            empty.splice(0, 1)[0].val('Read Later');
                        }
                        empty.forEach(input => {
                            input.remove();
                        });
                    })
                    .insertBefore(btnAddFolderName);
            };
            names.forEach(fInsertName);
            btnAddFolderName.click(() => {
                fInsertName('');
            });

            txtReadLaterPageTimeout
                .val(settings.readLaterPageTimeout / 1000)
                .on('keyup paste', function() {
                    settings.readLaterPageTimeout = (+($(this).val()) || 10) * 1000;
                    api.setSettings(settings);
                });
            chkStoreAllDeletedBookmarks
                .prop('checked', settings.storeAllDeletedBookmarks)
                .click(function() {
                    settings.storeAllDeletedBookmarks = $(this).prop('checked');
                    api.setSettings(settings);
                });
            txtAutoClearDeleted
                .val(settings.daysAutoClearDeleted || '')
                .on('keyup paste', function() {
                    let val = +($(this).val()) || 0;
                    if (val < 0) val = 0;
                    settings.daysAutoClearDeleted = val;
                    api.setSettings(settings);
                });
            chkPreloadNext
                .prop('checked', settings.preloadNext)
                .click(function() {
                    settings.preloadNext = $(this).prop('checked');
                    api.setSettings(settings);
                });
            txtCustomUrlComparison
                .val(settings.urlComparisonSchema)
                .on('keyup paste', function() {
                    const val = $(this).val();
                    if (ApiWrapper.isValidUrlComparisonSchema(val)) {
                        settings.urlComparisonSchema = val;
                        api.setSettings(settings);
                        txtCustomUrlComparisonInvalid.css({
                            visibility: 'hidden'
                        });
                    } else {
                        txtCustomUrlComparisonInvalid.css({
                            visibility: 'visible'
                        });
                    }
                });
        });

        aShortcuts.click(ev => {
            ev.preventDefault();
            divShortcuts.show();
            const browser = ApiWrapper.getBrowser();
            if (browser.isChrome) {
                divShortcutsChrome.show();
            } else
            if (browser.isFirefox) {
                divShortcutsFirefox.show();
            } else
            if (browser.isOpera) {
                divShortcutsOpera.show();
                api.selectOrNew('opera://settings/configureCommands');
            }
        });

        $('#divTabs').tabs({
            active: 1,
            heightStyle: 'content'
        });
    });

})(jQuery);