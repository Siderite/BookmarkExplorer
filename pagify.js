function createTree(itm, level) {
	var elem = $('<div></div>');
	if (itm.children) {
		if (level > 1)
			elem.addClass('subtree');
		elem.append($('<h' + level + '></h' + level + '>').text(itm.title));
		var ul = $('<ul></ul>').appendTo(elem);
		itm.children.forEach(function (child) {
			$('<li></li>')
			.append(createTree(child, level + 1))
			.appendTo(ul);
		});
	} else
		if (itm.url) {
			$('<a></a>')
			.text(itm.title || itm.url)
			.attr('href', itm.url || '#')
			.attr('target', '_blank')
			.appendTo(elem);
			var chk = $('<input />')
				.attr('type', 'checkbox')
				.val(itm.id)
				.attr('title', 'Mark for delete');
			if (level == 2)
				chk.appendTo(elem);
			elem.click(function () {
				chk.click();
			});
		}
	return elem;
}

function refresh(data) {
	if (!data.folder)
		return;
	var tree = $('#tree').empty();
	tree.append(createTree(data.folder, 1));
	$('a', '#tree').each(function () {
		if (sameUrls($(this).attr('href'), data.current.url)) {
			$(this).addClass('selected');
		}
	});
}

$(function () {
	chrome.runtime.onMessage.addListener(refresh);

	$('#btnToggleAll').click(function () {
		var val = $('#tree>div>ul>li>div>input:checked').length < $('#tree>div>ul>li>div>input:not(:checked)').length;
		$('#tree>div>ul>li>div>input').prop('checked', val);
	});
	$('#btnToggleBefore').click(function () {
		var index = $('#tree>div>ul>li:has(a.selected)').index();
		var val = $('#tree>div>ul>li>div>input:lt(' + index + '):checked').length < $('#tree>div>ul>li>div>input:lt(' + index + '):not(:checked)').length;
		$('#tree>div>ul>li>div>input:lt(' + index + ')').prop('checked', val);
	});
	$('#btnRemove').click(function () {
		var inputs = $('input:checked');
		if (!inputs.length)
			return;
		if (!confirm('Are you sure you want to delete ' + inputs.length + ' bookmarks?'))
			return;
		var ids = [];
		inputs.each(function () {
			var id =  + ($(this).val());
			if (id) {
				id += '';
				var input = this;
				chrome.bookmarks.remove(id, function () {
					$(input).closest('li').remove();
				});
			}
		});
	});
});