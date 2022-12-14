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
			var cloned = profiles[p].clone;
			var synced = profiles[p].autoSync;

			var cloneIconClasses = cloned ? 'fa fa-solid fa-check-circle iconGreen' : 'fa fa-solid fa-times-circle iconRed';
			var syncIconClasses = synced ? 'fa fa-solid fa-check-circle iconGreen' : 'fa fa-solid fa-times-circle iconRed';
			
			var clonedTooltipText = cloned ? 'The notebook is cloned locally' : 'The notebook is not cloned locally';
			var syncedTooltipText = synced ? 'The notebook is auto-synced to the remote server' : 'The notebook is not auto-synced to the remote server';
			
			remoteList.push(
				$('<tr></tr>').append(
					$('<td class="profileSelectElementContainer"></td>').append(
						$('<div class="btn btn-primary profileSelectBtn" data-url="' + profiles[p].url + '">' + Tools.getBasename(profiles[p].url) + '</div>')
						.on('click', function(event) {
							event.stopPropagation();
							
							Database.getInstance().profileHandler.selectOrCreateProfile($(this).data().url);
							Database.getInstance().reset();
							Notes.getInstance().routing.call();
						})
					),
					$('<td class="profileSelectInfo"></td>')
					.append(
						(profiles[p].url != "local") 
						? 
						[ 
							$('<span class="profileSelectStatusIcons"></span>').append(
								$('<span data-toggle="tooltip" title="' + clonedTooltipText + '" class="' + cloneIconClasses + '"></span>'),
								$('<span data-toggle="tooltip" title="' + syncedTooltipText + '" class="' + syncIconClasses + '"></span>')
							),
							
							$('<span class="profileSelectStatusText"></span>')
							.html(profiles[p].url),
							
							$('<a data-url="' + profiles[p].url + '" href="javascript:void(0);" class="profileSelectStatusCloseLink">Close...</a>')
							.on('click', function(event) {
								event.stopPropagation();
								var url = $(this).data().url;
								
								if (!confirm('Really close the notebook at ' + url + '? This will only delete local data, the remote database is not being touched.')) {
									return;
								}
								Database.getInstance().profileHandler.deleteProfile(url);
								Database.getInstance().reset();
								
								location.reload();
							})
						]
						:
						[
							$('<span class="profileSelectStatusText"></span>')
							.html('Local notebook')
						]
					)
				)
			);
		}
		
		remoteList.push(
			$('<tr></tr>').append(
				$('<td class="profileSelectElementContainer"></td>').append(
					$('<button class="btn btn-secondary profileSelectBtnFixed">Add Notebook from CouchDB URL...</button>')
					.on('click', function() {
						var url = prompt('CouchDB Address:');
						if (!url) return;
						
						var d = Database.getInstance();
						var n = Notes.getInstance();
						
						Database.getInstance().reset();
						Notes.getInstance().routing.call('', url);
					})
				)
			)
		);
		remoteList.push(
			$('<tr></tr>').append(
				$('<td class="profileSelectElementContainer"></td>').append(
					$('<button class="btn btn-secondary profileSelectBtnFixed">Open Notebook...</button>')
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
					})
				)
			)
		);

		var overview = $('<div class="prettyPageBody profileDocContent"></div>');

		// Build profiles page
		$('#contentContainer').append(
			$('<div id="#profileSelection"></div>').append(
				$('<div class="prettyPageBody"><h3>Welcome to the Notes App!</h3>Please select an already opened Notebook, or add a new one. You can also choose the local option for testing the app locally with no remote server connected. See the <a href="#/doc/usage">usage documentation</a> for details.<br><br></div>'),
				
				$('<table id="profileList"></table>').append(
					$('<tbody></tbody>').append(
						remoteList
					)
				),
				
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