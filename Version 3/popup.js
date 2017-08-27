(function($) {

    const global = this;
    const context = global.testContext && global.testContext.document || global.document;
    const chrome = global.testContext && global.testContext.chrome ? global.testContext.chrome : global.chrome;
    const api = new ApiWrapper(chrome);

    $(() => {

        const btnPrev = $('#btnPrev', context);
        const btnSkip = $('#btnSkip', context);
        const btnNext = $('#btnNext', context);
        const btnManage = $('#btnManage', context);
        const btnSettings = $('#divHeader img', context);
        const divFolder = $('#divFolder', context);

        api.getBackgroundPage().then(bgPage => {

            const app = bgPage.app;

            btnPrev.click(() => {
                app.execute('prevBookmark');
            });
            btnSkip.click(() => {
                app.execute('skipBookmark');
            });
            btnNext.click(() => {
                app.execute('nextBookmark');
            });
            btnManage.click(() => {
                app.execute('manage');
                window.close();
            });
            btnSettings.click(() => {
                app.execute('settings');
                window.close();
            });

            function refresh() {
                const browser = ApiWrapper.getBrowser();
                api.getSettings().then(settings => {
                    btnSkip.toggle(!settings.hideSkipButton);
                    api.getCurrentTab().then(tab => {
                        app.getInfo(tab.url).then(data => {
                            app.handleDuplicates(data, tab).then(data => {
                                if (data && data.folder) {
                                    divFolder.text(data.folder.title);
                                    divFolder.attr('title', `${data.path} : ${data.index}`);
                                    btnManage.show();
                                } else {
                                    divFolder.text('Not bookmarked');
                                    divFolder.attr('title', 'Current page not found in bookmarks');
                                }

                                if (data && data.prev) {
                                    btnPrev.prop('disabled', false);
                                    btnPrev.data('url', data.prev.url);
                                    const shortcutText = browser.isChrome ?
                                        '(Ctrl-Shift-K)' :
                                        '(Ctrl-Shift-O)';
                                    btnPrev.attr('title', `${data.prev.title || ''}\r\n${data.prev.url}\r\n${shortcutText}`);
                                } else {
                                    btnPrev.prop('disabled', true);
                                    btnPrev.removeData('url')
                                    btnPrev.attr('title', 'No previous bookmark');
                                }

                                if (data && data.next) {
                                    btnNext.prop('disabled', false);
                                    btnSkip.prop('disabled', false);
                                    btnNext.data('url', data.next.url);
                                    btnNext.attr('title', `${data.next.title || ''}\r\n${data.next.url}\r\n(Ctrl-Shift-L)`);
                                    btnSkip.attr('title', 'Skip bookmark (move it to the end of folder)');
                                } else {
                                    btnNext.prop('disabled', true);
                                    btnSkip.prop('disabled', true);
                                    btnNext.removeData('url');
                                    btnNext.attr('title', 'No next bookmark');
                                    btnSkip.attr('title', 'No next bookmark');
                                }
                            });
                        });
                    });
                });
            }

            refresh();
            api.onUpdatedTab(refresh);
        });
    });

})(jQuery);