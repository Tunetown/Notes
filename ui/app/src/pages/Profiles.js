/**
 * Shows profiles to select from.
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
class Profiles {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Profiles.instance) Profiles.instance = new Profiles();
		return Profiles.instance;
	}
	
	/**
	 * Loads the passed version history data into the versions view.
	 */
	load() {
		var n = Notes.getInstance();
		var d = Database.getInstance();
		
		// Set note name in the header
		n.setStatusText("Choose notebook"); 

		// Build list of available remotes
		var remoteList = [];
		var profiles = d.profileHandler.getProfiles();
		for(var p in profiles) {
			remoteList.push(
				$('<div class="profileSelectElementContainer"></div>').append(
					$('<div class="btn btn-primary profileSelectBtn" data-url="' + profiles[p].url + '">' + Tools.getBasename(profiles[p].url) + '</div>')
					.on('click', function(event) {
						Database.getInstance().profileHandler.selectOrCreateProfile($(this).data().url);
						Database.getInstance().reset();
						Notes.getInstance().routing.call();
					}),
					$('<div class="profileSelectInfo">' + profiles[p].url + '</div>')
				)
			);
		}

		var overview = $('<div class="prettyPageBody profileDocContent"></div>');

		// Build profiles page
		$('#contentContainer').append(
			$('<div id="#profileSelection"></div>').append(
				$('<div class="prettyPageBody"><h3>Welcome to the Notes App!</h3>Please select an already opened Notebook, or add a new one. You can also choose the local option for testing the app locally with no remote server connected. See the <a href="#/doc/usage">usage documentation</a> for details.<br><br></div>'),
				
				$('<div id="#profileList"></div>').append(
					remoteList
				),
				
				$('<br>'),
				
				$('<button class="btn btn-secondary profileSelectBtn">Add Notebook from CouchDB URL...</button>')
				.on('click', function() {
					var url = prompt('CouchDB Address:');
					if (!url) return;
					
					var d = Database.getInstance();
					var n = Notes.getInstance();
					
					Database.getInstance().reset();
					Notes.getInstance().routing.call('', url);
				}),
				
				$('<button class="btn btn-secondary profileSelectBtn">Open Notebook...</button>')
				.on('click', function() {
					var setting = prompt('Import profile:');
					if (!setting) return;
					
					var d = Database.getInstance();
					var n = Notes.getInstance();
					
					try {
						d.profileHandler.importProfile(setting);
						d.get().then(function(data) {
							d.reset();
							n.routing.call('settings');
						}).catch(function(err) {
							d.reset();
							n.routing.call('settings');
						});
		
						n.setStatusText('Importing profile');
						
					} catch (e) {
						n.showAlert('Error importing profile: ' + e);
					}
				}),
				
				$('<br>'),
				
				overview,
			)
		);
		
		// Load help overview page
		var baseURL = location.protocol +'//'+ location.host + (location.pathname ? location.pathname : '') + 'ui/app/doc/overview.html';
		jQuery.get(baseURL, function(data) {
			overview.html(data);
		});
		/*.fail(function(err) {
			contentContainer.html(err.responseText);	
		});*/
	}
}