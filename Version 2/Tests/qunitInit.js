QUnit.config.testTimeout = 1000;
QUnit.config.hidepassed = true;
QUnit.config.collapse = false;
QUnit.config.urlConfig.splice(1,1);

function stringFunctions() {
	if (!arguments.length)
		throw 'needs functions as parameters';
	var f = function () {};
	var args = arguments;
	for (var i = args.length - 1; i >= 0; i--) {
		(function () {
			var x = i;
			var func = args[x];
			if (typeof(func) != 'function')
				throw 'parameter ' + x + ' is not a function';
			var prev = f;
			f = function () {
				setTimeout(function () {
					func();
					prev();
				}, 1);
			};
		})();
	};
	f();
};

if (/^file:/.test(document.location.href)) {
	window.history.replaceState=function() {};
}

var expandInterval=setInterval(function() {
	var options=$('.qunit-url-config');
	if (options.length) {
		setTimeout(function() { clearInterval(expandInterval); },50);
		var newOption = $('<label for="qunit-urlconfig-expand" title="Expand or collapse all test data."><input id="qunit-urlconfig-expand" name="expand" type="checkbox" title="Expand or collapse all test data.">Expand all</label>').appendTo(options);
		newOption.find('input').click(function() {
			var checked=$(this).is(':checked');
			$('.qunit-assert-list,.qunit-source').toggleClass('qunit-collapsed',!checked);
		});
	}
},100);