(function () {

	const global = this;
	const context = global.testContext || global;

	global.api = new ApiWrapper(global.chrome);
	global.app = new BookmarkExplorer(api);

})();