AddBtnMenu();

function AddBtnMenu() {
	let btnMenu = document.createElement("div");
	btnMenu.className = "button-menu";
	btnMenu.id = "menu";
	btnMenu.innerHTML =
		`<button type="button" class="btn icon-language" id="practiceMenu" title="Practice"></button>
		<button type="button" class="btn icon-edit" id="edit" title="Edit"></button>
		<button type="button" class="btn icon-cloud_upload" id="import" title="Import"></button>
		<button type="button" class="btn icon-cloud_download" id="export" title="Export"></button>
		<button type="button" class="btn icon-ban" id="block" title="Block"></button>
		<button type="button" class="btn icon-cog" id="settings" title="Settings"></button>`;

	let body = document.querySelector("body");
	let page = body.getAttribute("data-rm");

	let pageBtn = btnMenu.querySelector(`#${page}`);
	if (pageBtn) {
		pageBtn.remove();

		let back = document.createElement("button");
		back.id = "menu";
		back.className = "btn icon-long-arrow-left";
		back.title = "Back to Menu";
	
		btnMenu.prepend(back);
	}

	for (let child of btnMenu.children) {
		child.onclick = function() {
			let url = chrome.runtime.getURL("static/templates/" + this.id + ".html");
			fetch(url)
			.then(response => {
				if (response.ok) {
					return response.text();
				} else {
					ShowError(response.status);
				}
			}).then(text => {
				document.open();
				document.write(text);
				document.close();
			})
			.catch(error => ShowError(error));
		}
	}
	
	body.appendChild(btnMenu);
}

function ShowError(text) {
	let msg = document.createElement("div");
	msg.className = "center-msg";
	msg.innerHTML =
		`<div>Error</div>
		<div>${text}</div>`;

	let container = document.querySelector(".practice-terminal");
	container.replaceChildren(msg);
	container.classList.add("center");
}