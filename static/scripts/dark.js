var dark;

// initial load of dark mode
if (dark == null) {
	chrome.storage.local.get("settings", storage => {
		if (!storage.settings)
			storage.settings = {};
		
		dark = storage.settings.darkMode;
		if (dark === false) {
			document.documentElement.setAttribute("data-theme", "light");
		}
	});
// dark stays as global variable, don't need to recall
} else if (dark === false) {
	document.documentElement.setAttribute("data-theme", "light");
}