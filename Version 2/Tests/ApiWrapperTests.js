QUnit.module("ApiWrapper");

QUnit.test("ApiWrapper.SameUrls", function (assert) {
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng', 'http://somethingel.se'), 0, "URLs with different domains are different.");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng', 'https://somethi.ng'), 0, "URLs with different schemas are different.");
	assert.equal(ApiWrapper.sameUrls('http://x.somethi.ng', 'http://y.somethi.ng'), 0, "URLs with different hosts are different.");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng/', 'http://somethi.ng'), 3, "URLs are equal if differring only by a final dash.");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng/?x=1&y=2', 'http://somethi.ng?x=1&y=2'), 3, "URLs are equal if differring only by a final dash. (with parameters)");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng/#hash', 'http://somethi.ng#hash'), 3, "URLs are equal if differring only by a final dash. (with hash)");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng/?x=1&y=2#hash', 'http://somethi.ng?x=1&y=2#hash'), 3, "URLs are equal if differring only by a final dash. (with parameters and hash)");
	assert.equal(ApiWrapper.sameUrls('http://somethi.NG?x=1&Y=2#hAsh', 'http://somethi.ng?x=1&y=2#hash'), 3, "URLs are equal if differring only by capitalization");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng?x=1&y=2', 'http://somethi.ng?x=1&y=2#hash'), 2, "URLs are equal rank 2 when hash is missing from one");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng?x=1&y=2#another', 'http://somethi.ng?x=1&y=2#hash'), 2, "URLs are equal rank 2 when only hashes are different");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng#hash', 'http://somethi.ng?x=1&y=2#hash'), 1, "URLs are equal rank 1 when parameters are missing from one");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng#another', 'http://somethi.ng?x=1&y=2#hash'), 1, "URLs are equal rank 1 when parameters are missing from one and hashes are different");
	assert.equal(ApiWrapper.sameUrls('http://somethi.ng/?x=1&y=2#hash', 'http://somethi.ng?x=1&y=2#'), 2, "having an empty hash doesn't break the regular expression");
});

QUnit.test("ApiWrapper init", function (assert) {
	assert.throws(function () {
		new ApiWrapper();
	}, "ApiWrapper crashes with no parameter");
	assert.ok(new ApiWrapper({}), "ApiWrapper init doesn't crash with an empty object as parameter");
	var chrome = {
		tabs : {
			onUpdated : {
				addListener : function () {
					chrome.updatedListener = arguments[0];
				}
			},
			onRemoved : {
				addListener : function () {
					chrome.removedListener = arguments[0];
				}
			}
		}
	};
	assert.ok(new ApiWrapper(chrome), "ApiWrapper init binds to a chrome like object");
	assert.ok(typeof(chrome.updatedListener) == 'function', "ApiWrapper init binds to chrome.tabs.onUpdated with a listener function");
	assert.ok(typeof(chrome.removedListener) == 'function', "ApiWrapper init binds to chrome.tabs.onRemoved with a listener function");
});

QUnit.test("ApiWrapper getCurrentTab", function (assert) {
	var chrome = {
		tabs : {
			query : function (queryInfo, callback) {
				chrome.queryInfo = queryInfo;
				chrome.callback = callback;
				callback(["expected result"]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.queryInfo, "ApiWrapper doesn't populate queryInfo by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getCurrentTab();
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getCurrentTab returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.queryInfo && typeof(chrome.queryInfo) == 'object', "ApiWrapper getCurrentTab populates queryInfo");
		assert.ok(chrome.queryInfo.active && chrome.queryInfo.lastFocusedWindow, "ApiWrapper getCurrentTab queries for the active last focused window");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getCurrentTab populates callback");
		assert.equal(result, "expected result", "ApiWrapper getCurrentTab returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getBackgroundPage", function (assert) {
	var chrome = {
		runtime : {
			getBackgroundPage : function (callback) {
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getBackgroundPage();
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getBackgroundPage returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getBackgroundPage populates callback");
		assert.equal(result, "expected result", "ApiWrapper getBackgroundPage returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper setUrl", function (assert) {
	var chrome = {
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		},
		tabs : {
			update : function (tabId, properties, callback) {
				chrome.tabId = tabId;
				chrome.properties = properties;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.properties, "ApiWrapper doesn't populate properties by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.setUrl(12, "test url");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper setUrl returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.tabId, 12, "ApiWrapper setUrl populates tabId");
		assert.ok(chrome.properties && typeof(chrome.properties) == 'object', "ApiWrapper setUrl populates properties");
		assert.equal(chrome.properties.url, "test url", "ApiWrapper setUrl updates the url");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper setUrl populates callback");
		assert.equal(result, "expected result", "ApiWrapper setUrl returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper notify", function (assert) {
	var chrome = {
		notifications : {
			create : function (notificationid, options, callback) {
				chrome.options = options;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.options, "ApiWrapper doesn't populate options by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.notify("test text");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper notify returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.options && typeof(chrome.options) == 'object', "ApiWrapper notify populates options");
		assert.equal(chrome.options.message, "test text", "ApiWrapper notify sets the correct message");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper notify populates callback");
		assert.equal(result, "expected result", "ApiWrapper notify returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper setData", function (assert) {
	var chrome = {
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.callback = callback;
					callback("expected result");
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.items, "ApiWrapper doesn't populate items by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.setData("test key", "test value");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper setData returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.items && typeof(chrome.items) == 'object', "ApiWrapper setData populates items");
		assert.equal(chrome.items["test key"], "test value", "ApiWrapper setData sends the correct item data");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper setData populates callback");
		assert.equal(result, "expected result", "ApiWrapper setData returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getData with no data", function (assert) {
	var chrome = {
		storage : {
			local : {
				get : function (key, callback) {
					chrome.key = key;
					chrome.callback = callback;
					callback({});
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.key, "ApiWrapper doesn't populate key by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getData("test key");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getData returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.key && typeof(chrome.key) == 'string', "ApiWrapper getData populates key");
		assert.equal(chrome.key, "test key", "ApiWrapper getData sends the correct item data");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getData populates callback");
		assert.notOk(result, "ApiWrapper getData returns a promise that then receives an empty value");
	});
});

QUnit.test("ApiWrapper getData with data", function (assert) {
	var chrome = {
		storage : {
			local : {
				get : function (key, callback) {
					chrome.key = key;
					chrome.callback = callback;
					callback({
						"test key" : "expected result"
					});
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.key, "ApiWrapper doesn't populate key by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getData("test key");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getData returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.key && typeof(chrome.key) == 'string', "ApiWrapper getData populates key");
		assert.equal(chrome.key, "test key", "ApiWrapper getData sends the correct item data");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getData populates callback");
		assert.equal(result, "expected result", "ApiWrapper getData returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper removeData", function (assert) {
	var chrome = {
		storage : {
			local : {
				remove : function (key, callback) {
					chrome.key = key;
					chrome.callback = callback;
					callback("expected result");
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.key, "ApiWrapper doesn't populate key by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.removeData("test key");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper removeData returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.key && typeof(chrome.key) == 'string', "ApiWrapper removeData populates key");
		assert.equal(chrome.key, "test key", "ApiWrapper removeData sends the correct item data");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper removeData populates callback");
		assert.equal(result, "expected result", "ApiWrapper removeData returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper setIcon", function (assert) {
	var chrome = {
		browserAction : {
			setIcon : function (details, callback) {
				chrome.details = details;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.details, "ApiWrapper doesn't populate details by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.setIcon(12, "test icon");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper setIcon returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.details && typeof(chrome.details) == 'object', "ApiWrapper setIcon populates details");
		assert.equal(chrome.details.tabId, 12, "ApiWrapper setIcon populates details.tabId");
		assert.equal(chrome.details.path[19], "test icon", "ApiWrapper setIcon updates the icon for size 19");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper setIcon populates callback");
		assert.equal(result, "expected result", "ApiWrapper setIcon returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getExtensionUrl", function (assert) {
	var chrome = {
		extension : {
			getURL : function (url) {
				return "expected result";
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var result = api.getExtensionUrl("test url");
	assert.equal(result, "expected result", "ApiWrapper getExtensionUrl correctly calls extension.getURL");
});

QUnit.test("ApiWrapper getTabById", function (assert) {
	var chrome = {
		tabs : {
			get : function (tabId, callback) {
				chrome.tabId = tabId;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getTabById(13);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getTabById returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.tabId, 13, "ApiWrapper getTabById sends the correct populates tabId");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getTabById populates callback");
		assert.equal(result, "expected result", "ApiWrapper getTabById returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getTabsByUrl", function (assert) {
	var chrome = {
		tabs : {
			query : function (queryInfo, callback) {
				chrome.queryInfo = queryInfo;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.queryInfo, "ApiWrapper doesn't populate queryInfo by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getTabsByUrl("test url");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getTabsByUrl returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.queryInfo && typeof(chrome.queryInfo) == 'object', "ApiWrapper getTabsByUrl populates queryInfo");
		assert.equal(chrome.queryInfo.url, 'test url*', "ApiWrapper getTabsByUrl uses the correct queryInfo");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getTabsByUrl populates callback");
		assert.equal(result, "expected result", "ApiWrapper getTabsByUrl returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper newTab", function (assert) {
	var chrome = {
		tabs : {
			create : function (createProperties, callback) {
				chrome.createProperties = createProperties;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.createProperties, "ApiWrapper doesn't populate createProperties by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.newTab("test url");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper newTab returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.createProperties && typeof(chrome.createProperties) == 'object', "ApiWrapper newTab populates createProperties");
		assert.equal(chrome.createProperties.url, 'test url', "ApiWrapper newTab uses the correct createProperties");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper newTab populates callback");
		assert.equal(result, "expected result", "ApiWrapper newTab returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper setSelected", function (assert) {
	var chrome = {
		tabs : {
			update : function (tabId, properties, callback) {
				chrome.tabId = tabId;
				chrome.properties = properties;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.properties, "ApiWrapper doesn't populate properties by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.setSelected(12);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper setSelected returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.tabId, 12, "ApiWrapper setSelected populates tabId");
		assert.ok(chrome.properties && typeof(chrome.properties) == 'object', "ApiWrapper setSelected populates properties");
		assert.equal(chrome.properties.selected, true, "ApiWrapper setSelected updates the url");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper setSelected populates callback");
		assert.equal(result, "expected result", "ApiWrapper setSelected returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper selectOrNew when tab not opened", function (assert) {
	var chrome = {
		tabs : {
			query : function (queryInfo, callback) {
				callback([]);
			},
			create : function (createProperties, callback) {
				chrome.createProperties = createProperties;
				chrome.callback = callback;
				callback("expected create result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.createProperties, "ApiWrapper doesn't populate createProperties by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.selectOrNew("test url");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper selectOrNew returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.createProperties && typeof(chrome.createProperties) == 'object', "ApiWrapper selectOrNew populates createProperties");
		assert.equal(chrome.createProperties.url, 'test url', "ApiWrapper selectOrNew uses the correct createProperties");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper selectOrNew populates callback");
		assert.equal(result, "expected create result", "ApiWrapper selectOrNew returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper selectOrNew when tab is opened", function (assert) {
	var chrome = {
		tabs : {
			query : function (queryInfo, callback) {
				callback([{
							id : 12
						}
					]);
			},
			update : function (tabId, properties, callback) {
				chrome.tabId = tabId;
				chrome.properties = properties;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.properties, "ApiWrapper doesn't populate properties by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.selectOrNew("test url");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper selectOrNew returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.tabId, 12, "ApiWrapper selectOrNew populates tabId");
		assert.ok(chrome.properties && typeof(chrome.properties) == 'object', "ApiWrapper selectOrNew populates properties");
		assert.equal(chrome.properties.selected, true, "ApiWrapper selectOrNew updates the url");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper selectOrNew populates callback");
		assert.equal(result, "expected result", "ApiWrapper selectOrNew returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getTree", function (assert) {
	var chrome = {
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getTree();
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getTree returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getTree populates callback");
		assert.equal(result, "expected result", "ApiWrapper getTree returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getBookmarksBar", function (assert) {
	var chrome = {
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : ["expected result"]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getBookmarksBar();
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getBookmarksBar returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getBookmarksBar populates callback");
		assert.equal(result, "expected result", "ApiWrapper getBookmarksBar returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getBookmarksByIds", function (assert) {
	var chrome = {
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : [{
									children : [{
											id : 10,
										}, {
											id : 11,
										}, {
											id : 12,
										}, {
											id : 13,
										}, {
											id : 14,
										}
									]
								}, {
									id : 15
								}
							]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getBookmarksByIds([10, 12, 15]);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getBookmarksByIds returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getBookmarksByIds populates callback");
		assert.deepEqual(result, [{
					id : 10,
				}, {
					id : 12,
				}, {
					id : 15,
				}
			], "ApiWrapper getBookmarksByIds returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getBookmarksByUrl", function (assert) {
	var chrome = {
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : [{
									children : [{
											url : "url10",
										}, {
											url : "url11",
										}, {
											id : "1",
											url : "url12",
										}, {
											id : "2",
											url : "url12",
										}, {
											url : "url13",
										}, {
											url : "url14",
										}
									]
								}, {
									url : "url15"
								}, {
									id : "3",
									url : "url12",
								}
							]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getBookmarksByUrl("url12");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getBookmarksByUrl returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper getBookmarksByUrl populates callback");
		assert.deepEqual(result, [{
					id : "1",
					url : "url12"
				}, {
					id : "2",
					url : "url12"
				}, {
					id : "3",
					url : "url12"
				}
			], "ApiWrapper getBookmarksByUrl returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper removeBookmarksById", function (assert) {
	var chrome = {
		removedBookmarks : [],
		bookmarks : {
			remove : function (id) {
				chrome.removedBookmarks.push(id);
			},
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : [{
									children : [{
											id : 10,
										}, {
											id : 11,
										}, {
											id : 12,
										}, {
											id : 13,
										}, {
											id : 14,
										}
									]
								}, {
									id : 15
								}
							]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.removeBookmarksById([10, 12, 15]);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper removeBookmarksById returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper removeBookmarksById populates callback");
		assert.deepEqual(chrome.removedBookmarks, [10, 12, 15], "ApiWrapper removeBookmarksById correctly calls bookmarks.remove");
		assert.deepEqual(result, [{
					id : 10,
				}, {
					id : 12,
				}, {
					id : 15,
				}
			], "ApiWrapper removeBookmarksById returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper createBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			create : function (bookmarkData, callback) {
				chrome.bookmarkData = bookmarkData;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.bookmarkData, "ApiWrapper doesn't populate bookmarkData by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.createBookmarks({
			title : 'test title',
			parentId : '21'
		});
	assert.ok(promise && promise instanceof Promise, "ApiWrapper createBookmarks returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.bookmarkData && typeof(chrome.bookmarkData) == 'object', "ApiWrapper createBookmarks populates bookmarkData");
		assert.equal(chrome.bookmarkData.title, 'test title', "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.equal(chrome.bookmarkData.parentId, 21, "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper createBookmarks populates callback");
		assert.equal(result, "expected result", "ApiWrapper createBookmarks returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper createBookmarks", function (assert) {
	var chrome = {
		bookmarkData : [],
		bookmarks : {
			create : function (bookmarkData, callback) {
				chrome.bookmarkData.push(bookmarkData);
				chrome.callback = callback;
				callback(chrome.bookmarkData.length);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.createBookmarks([{
					title : 'test title1',
					parentId : '21'
				}, {
					title : 'test title2',
					parentId : '23'
				}
			]);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper createBookmarks returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.bookmarkData.length, 2, "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.equal(chrome.bookmarkData[0].title, 'test title1', "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.equal(chrome.bookmarkData[0].parentId, 21, "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.equal(chrome.bookmarkData[1].title, 'test title2', "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.equal(chrome.bookmarkData[1].parentId, 23, "ApiWrapper createBookmarks uses the correct bookmarkData");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper createBookmarks populates callback");
		assert.deepEqual(result, [1, 2], "ApiWrapper createBookmarks returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper createMenuItem", function (assert) {
	var chrome = {
		runtime : {},
		contextMenus : {
			create : function (menuItemData, callback) {
				chrome.menuItemData = menuItemData;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.menuItemData, "ApiWrapper doesn't populate menuItemData by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.createMenuItem('test id', 'test title');
	assert.ok(promise && promise instanceof Promise, "ApiWrapper createMenuItem returns a promise");
	return promise.then(function (result) {
		assert.ok(chrome.menuItemData && typeof(chrome.menuItemData) == 'object', "ApiWrapper createMenuItem populates menuItemData");
		assert.equal(chrome.menuItemData.title, 'test title', "ApiWrapper createMenuItem uses the correct menuItemData");
		assert.equal(chrome.menuItemData.id, 'test id', "ApiWrapper createMenuItem uses the correct menuItemData");
		assert.deepEqual(chrome.menuItemData.contexts, [
				"page",
				"frame",
				"selection",
				"link",
				"editable",
				"image",
				"video",
				"audio"
			], "ApiWrapper createMenuItem uses the correct menuItemData");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper createMenuItem populates callback");
		assert.deepEqual(result, {
			"contexts" : [
				"page",
				"frame",
				"selection",
				"link",
				"editable",
				"image",
				"video",
				"audio"
			],
			"id" : "test id",
			"title" : "test title"
		}, "ApiWrapper createMenuItem returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper removeMenuItem", function (assert) {
	var chrome = {
		runtime : {},
		contextMenus : {
			remove : function (id, callback) {
				chrome.id = id;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.id, "ApiWrapper doesn't populate id by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.removeMenuItem('test id', 'test title');
	assert.ok(promise && promise instanceof Promise, "ApiWrapper removeMenuItems returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.id, 'test id', "ApiWrapper removeMenuItems uses the correct id");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper removeMenuItems populates callback");
		assert.deepEqual(result, {
			"0" : "expected result"
		}, "ApiWrapper removeMenuItems returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper sendMessage", function (assert) {
	var chrome = {
		tabs : {
			sendMessage : function (tabId, message, options, callback) {
				chrome.tabId = tabId;
				chrome.message = message;
				chrome.callback = callback;
				callback("expected result");
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.message, "ApiWrapper doesn't populate message by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.sendMessage(12, "test message");
	assert.ok(promise && promise instanceof Promise, "ApiWrapper sendMessage returns a promise");
	return promise.then(function (result) {
		assert.equal(chrome.tabId, 12, "ApiWrapper sendMessage populates tabId");
		assert.equal(chrome.message, "test message", "ApiWrapper sendMessage sends the correct message");
		assert.ok(chrome.callback && typeof(chrome.callback) == 'function', "ApiWrapper sendMessage populates callback");
		assert.equal(result, "expected result", "ApiWrapper sendMessage returns a promise that then receives the result of the callback");
	});
});

QUnit.test("ApiWrapper getListOfUrls when there is no list", function (assert) {
	var chrome = {
		items:{},
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getListOfUrls(12);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getListOfUrls returns a promise");
	var to = setTimeout(function () {
			assert.ok(true, "ApiWrapper getListOfUrls then() should timeout");
		}, 500);
	promise.then(function (result) {
		if (to)
			clearTimeout(to);
		assert.notOk(true, "ApiWrapper getListOfUrls should not call then()");
	});
});

QUnit.test("ApiWrapper getListOfUrls when there is a list", function (assert) {
	var chrome = {
		items:{},
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	chrome.items.urlHistory = { 12 : ["expected result"] };
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getListOfUrls(12);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getListOfUrls returns a promise");
	var a=assert.async();
	promise.then(function (result) {
		assert.ok(true, "ApiWrapper getListOfUrls should call then()");
		a();
	});
});

QUnit.test("ApiWrapper pushUrlForTab when there is no list", function (assert) {
	var chrome = {
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var a=assert.async();
	api.pushUrlForTab(12,"test url").then(function() {
		api.getListOfUrls(12).then(function(list) {
			assert.deepEqual(list,["test url"],"pushUrlForTab creates a list of URLs for a tab and populates it");
			a();
		});
	});
});

QUnit.test("ApiWrapper pushUrlForTab when there is a list", function (assert) {
	var chrome = {
		items:{},
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	chrome.items.urlHistory = { 12 : ["another url"] };
	var a=assert.async();
	api.pushUrlForTab(12,"test url").then(function() {
		api.getListOfUrls(12).then(function(list) {
			assert.deepEqual(list,["another url","test url"],"pushUrlForTab appends to an existing list of URLs for a tab");
			a();
		});
	});
});

QUnit.test("ApiWrapper getLastTabBookmarkedUrl when there is no list", function (assert) {
	var chrome = {
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		},
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : [{
									children : [{
											url : "url10",
										}, {
											url : "url11",
										}, {
											id : "1",
											url : "url12",
										}, {
											id : "2",
											url : "url12",
										}, {
											url : "url13",
										}, {
											url : "url14",
										}
									]
								}, {
									url : "url15"
								}, {
									id : "3",
									url : "url12",
								}
							]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getLastTabBookmarkedUrl(12);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getLastTabBookmarkedUrl returns a promise");
	var to = setTimeout(function () {
			assert.ok(true, "ApiWrapper getLastTabBookmarkedUrl then() should timeout");
		}, 500);
	promise.then(function (result) {
		if (to)
			clearTimeout(to);
		assert.notOk(true, "ApiWrapper getLastTabBookmarkedUrl should not call then()");
	});
});

QUnit.test("ApiWrapper getLastTabBookmarkedUrl when there is a list", function (assert) {
	var chrome = {
		items:{},
		storage : {
			local : {
				set : function (items, callback) {
					chrome.items = items;
					chrome.setCallback = callback;
					callback("expected result");
				},
				get : function (key, callback) {
					chrome.key = key;
					chrome.getCallback = callback;
					callback(chrome.items);
				}
			}
		},
		bookmarks : {
			getTree : function (callback) {
				chrome.callback = callback;
				callback([{
							children : [{
									children : [{
											url : "url10",
										}, {
											url : "url11",
										}, {
											id : "1",
											url : "url12",
										}, {
											id : "2",
											url : "url12",
										}, {
											url : "url13",
										}, {
											url : "url14",
										}
									]
								}, {
									url : "url15"
								}, {
									id : "3",
									url : "url12",
								}
							]
						}
					]);
			}
		}
	};
	var api = new ApiWrapper(chrome);
	chrome.items.urlHistory = { 12 : ["url12"] };
	assert.notOk(chrome.tabId, "ApiWrapper doesn't populate tabId by default");
	assert.notOk(chrome.callback, "ApiWrapper doesn't populate callback by default");
	var promise = api.getLastTabBookmarkedUrl(12);
	assert.ok(promise && promise instanceof Promise, "ApiWrapper getLastTabBookmarkedUrl returns a promise");
	var a=assert.async();
	promise.then(function (result) {
		assert.equal(result, "url12", "ApiWrapper getLastTabBookmarkedUrl should call then() with the correct value");
		a();
	});
});

QUnit.test("ApiWrapper onUpdatedTab", function (assert) {
	var chrome = {
		tabs : {
			onUpdated : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onUpdatedTab(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onUpdatedTab received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onUpdatedTab returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onUpdatedTab returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.tabs.onUpdated, "ApiWrapper onUpdatedTab returned object has a reference to onUpdated");
	assert.equal(handler.listener, listener, "ApiWrapper onUpdatedTab returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onUpdatedTab returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onUpdatedTab returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onCreatedTab", function (assert) {
	var chrome = {
		tabs : {
			onCreated : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onCreatedTab(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onCreatedTab received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onCreatedTab returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onCreatedTab returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.tabs.onCreated, "ApiWrapper onCreatedTab returned object has a reference to onCreated");
	assert.equal(handler.listener, listener, "ApiWrapper onCreatedTab returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onCreatedTab returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onCreatedTab returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onRemovedTab", function (assert) {
	var chrome = {
		tabs : {
			onRemoved : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onRemovedTab(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onRemovedTab received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onRemovedTab returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onRemovedTab returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.tabs.onRemoved, "ApiWrapper onRemovedTab returned object has a reference to onRemoved");
	assert.equal(handler.listener, listener, "ApiWrapper onRemovedTab returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onRemovedTab returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onRemovedTab returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onActivatedTab", function (assert) {
	var chrome = {
		tabs : {
			onActivated : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onActivatedTab(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onActivatedTab received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onActivatedTab returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onActivatedTab returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.tabs.onActivated, "ApiWrapper onActivatedTab returned object has a reference to onActivated");
	assert.equal(handler.listener, listener, "ApiWrapper onActivatedTab returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onActivatedTab returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onActivatedTab returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onCreatedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onCreated : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onCreatedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onCreatedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onCreatedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onCreatedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onCreated, "ApiWrapper onCreatedBookmark returned object has a reference to onCreated");
	assert.equal(handler.listener, listener, "ApiWrapper onCreatedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onCreatedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onCreatedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onRemovedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onRemoved : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onRemovedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onRemovedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onRemovedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onRemovedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onRemoved, "ApiWrapper onRemovedBookmark returned object has a reference to onRemoved");
	assert.equal(handler.listener, listener, "ApiWrapper onRemovedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onRemovedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onRemovedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onChangedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onChanged : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onChangedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onChangedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onChangedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onChangedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onChanged, "ApiWrapper onChangedBookmark returned object has a reference to onChanged");
	assert.equal(handler.listener, listener, "ApiWrapper onChangedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onChangedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onChangedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onMovedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onMoved : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onMovedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onMovedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onMovedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onMovedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onMoved, "ApiWrapper onMovedBookmark returned object has a reference to onMoved");
	assert.equal(handler.listener, listener, "ApiWrapper onMovedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onMovedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onMovedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onChildrenReorderedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onChildrenReordered : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onChildrenReorderedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onChildrenReorderedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onChildrenReorderedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onChildrenReorderedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onChildrenReordered, "ApiWrapper onChildrenReorderedBookmark returned object has a reference to onChildrenReordered");
	assert.equal(handler.listener, listener, "ApiWrapper onChildrenReorderedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onChildrenReorderedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onChildrenReorderedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onImportEndedBookmark", function (assert) {
	var chrome = {
		bookmarks : {
			onImportEnded : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onImportEndedBookmark(listener);
	assert.equal(chrome.listener, listener, "ApiWrapper onImportEndedBookmark received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onImportEndedBookmark returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onImportEndedBookmark returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.bookmarks.onImportEnded, "ApiWrapper onImportEndedBookmark returned object has a reference to onImportEnded");
	assert.equal(handler.listener, listener, "ApiWrapper onImportEndedBookmark returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onImportEndedBookmark returned object is disposed on remove");
	assert.equal(chrome.removedListener, listener, "ApiWrapper onImportEndedBookmark returned object has removed the provided listener");
});

QUnit.test("ApiWrapper onMessage", function (assert) {
	var chrome = {
		runtime : {
			onMessage : {
				addListener : function (listener) {
					chrome.listener = listener;
				},
				removeListener : function (listener) {
					chrome.removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onMessage(listener);
	assert.notEqual(chrome.listener, listener, "ApiWrapper onMessage received a function that is not the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onMessage returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onMessage returned object is not disposed");
	assert.equal(handler.eventRoot, chrome.runtime.onMessage, "ApiWrapper onMessage returned object has a reference to onCreated");
	assert.equal(handler.listener, chrome.listener, "ApiWrapper onMessage returned object has a reference to the returned listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onMessage returned object is disposed on remove");
	assert.equal(chrome.removedListener, chrome.listener, "ApiWrapper onMessage returned object has removed the returned listener");
});

QUnit.test("ApiWrapper onCommand", function (assert) {
	var chrome = {
		commands : {
			onCommand : {
				addListener : function (listener) {
					chrome.c_listener = listener;
				},
				removeListener : function (listener) {
					chrome.c_removedListener = listener;
				}
			}
		},
		contextMenus : {
			onClicked : {
				addListener : function (listener) {
					chrome.m_listener = listener;
				},
				removeListener : function (listener) {
					chrome.m_removedListener = listener;
				}
			}
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handler = api.onCommand(listener);
	assert.ok(chrome.c_listener && chrome.m_listener, "ApiWrapper onCommand received the provided listener");
	assert.ok(handler && typeof(handler) == 'object', "ApiWrapper onCommand returns an object");
	assert.equal(handler.disposed, false, "ApiWrapper onCommand returned object is not disposed");
	assert.ok(handler.commandListener && handler.contextMenuListener, "ApiWrapper onCommand returned object has a reference to the provided listener");
	handler.remove();
	assert.equal(handler.disposed, true, "ApiWrapper onCommand returned object is disposed on remove");
	assert.ok(chrome.c_removedListener && chrome.m_removedListener, "ApiWrapper onCommand returned object has removed the provided listener");
});

QUnit.test("ApiWrapper getWebStoreUrl", function (assert) {
	var chrome = {
		runtime : {
			id : "test id"
		}
	};
	var api = new ApiWrapper(chrome);
	assert.equal(api.getWebStoreUrl(), "https://chrome.google.com/webstore/detail/test id", "ApiWrapper getWebStoreUrl returns the correct URL");
});

QUnit.test("ApiWrapper dispose", function (assert) {
	var ev = {
		addListener : function (listener) {
			chrome.listeners++;
		},
		removeListener : function (listener) {
			chrome.listeners--;
		}
	};
	var chrome = {
		listeners : 0,
		tabs : {
			onCreated : ev,
			onUpdated : ev,
			onRemoved : ev,
			onActivated : ev
		},
		bookmarks : {
			onCreated : ev,
			onRemoved : ev,
			onChanged : ev,
			onMoved : ev,
			onChildrenReordered : ev,
			onImportEnded : ev
		},
		runtime : {
			onMessage : ev
		},
		commands : {
			onCommand : ev
		},
		contextMenus : {
			onClicked : ev
		}
	};
	var api = new ApiWrapper(chrome);
	var listener = function () {};
	var handlers = [];
	handlers.push(api.onCreatedTab(listener));
	handlers.push(api.onUpdatedTab(listener));
	handlers.push(api.onRemovedTab(listener));
	handlers.push(api.onActivatedTab(listener));
	handlers.push(api.onCreatedBookmark(listener));
	handlers.push(api.onRemovedBookmark(listener));
	handlers.push(api.onChangedBookmark(listener));
	handlers.push(api.onMovedBookmark(listener));
	handlers.push(api.onChildrenReorderedBookmark(listener));
	handlers.push(api.onImportEndedBookmark(listener));
	handlers.push(api.onMessage(listener));
	handlers.push(api.onCommand(listener));
	assert.equal(chrome.listeners, handlers.length + 3, "ApiWrapper on methods registered the expected number of listeners"); // two from init, and two handlers for onCommand
	api.dispose();
	assert.equal(chrome.listeners, 0, "ApiWrapper dispose removed all listeners");
	var count = 0;
	handlers.forEach(function (handler) {
		if (handler.disposed)
			count++;
	});
	assert.equal(handlers.length, count, "ApiWrapper dispose disposed on event handlers");
});