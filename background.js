chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
        "title": 'Turn into Flashcards',
        "contexts": ["selection"],
        "id": "makeCardID"
    });

});

// call TextToCard when text is highlighted and button is clicked
chrome.contextMenus.onClicked.addListener(info => {
	chrome.storage.local.set({"text": info.selectionText, "toConfirm": "", "textLang": ""}, () => {
		chrome.tabs.create({
			url: "static/templates/confirm.html"
		})
	});
});
