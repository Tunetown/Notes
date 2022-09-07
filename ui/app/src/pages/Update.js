/**
 * Update page.
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class Update {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Update.instance) Update.instance = new Update();
		return Update.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document
	 */
	load() {
		var n = Notes.getInstance();
		
		n.setStatusText("About");
		
		var headerContainer = $('<div class="prettyPageBody helpPageHeader"></div>'); 
		this.contentContainer = $('<div class="prettyPageBody"></div>');
		$('#contentContainer').empty(); 
		$('#contentContainer').append(
			headerContainer,
			this.contentContainer 
		);
		
		headerContainer.append( 
			$('<div><h3>Notes App</h3><p>Version ' + n.appVersion + '</p><p>(C) 2021-2022 Thomas Weber (tom-vibrant[at]gmx.de)</p><p>License: GPL v3</p></div><br>'),
		);
		 
		var files = n.outOfDateFiles;
		if (files.length == 0) {
			headerContainer.append( 
				$('<div>The app is up to date with the host (' + location.host + '). If you want to re-load the whole app sources anyway, click here:</div><br>'),
				$('<div class="btn btn-primary updateInstallBtn">Reload App Sources...</div><br><br>')
				.on('click', function(event) {
					Notes.getInstance().installUpdates();
				}),
				$('<div><em>Technical Info: This forces the service worker to be reinstalled, and loads all sources from the host again. The PWA installation is not touched!</em></div><br>'),
			);
		} else {
			headerContainer.append(
				$('<div>Updates are available from ' + location.host + '. Click here to install them:</div><br>'),
				$('<div class="btn btn-primary updateInstallBtn">Install Updates...</div><br><br>')
				.on('click', function(event) {
					Notes.getInstance().installUpdates();
				})
			);
			
			var that = this;
			this.contentContainer.append(
				$('<a onclick="Update.getInstance().showDiff()" href="javascript:void(0);">Show files to be updated...</a>')
			);
		}
		
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Refresh" class="fa fa-redo" onclick="event.stopPropagation();Update.getInstance().load();"></div>'),
		]);
	}
	
	showDiff() {
		if (!this.contentContainer) return;
		
		var n = Notes.getInstance();
		var files = n.outOfDateFiles;
		var chgRows = new Array();
		for(var i=0; i<files.length; ++i) {
			var url = files[i]; 
			
			chgRows.push(
				$('<tr>').append([
					$('<td class="tableAlignMiddle">' + url + '</td>'),
				])
			);
		}
		
		this.contentContainer.empty();
		this.contentContainer.append(
			$('<table class="table table-striped table-hover" />').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Out of date files</th>'),
							]
						)
					),
					$('<tbody/>').append(chgRows),
				]
			)
		);
	}
}