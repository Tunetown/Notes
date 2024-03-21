/**
 * Help viewer
 * 
 * (C) Thomas Weber 2022 tom-vibrant@gmx.de
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
class HelpPage extends Page {
	
	/**
	 * Loads the passed version history data into the versions view. doc is a cdb document.
	 * 
	 * docpage is optional.
	 */
	async load(docpage) {
		this._tab.setStatusText("Help Pages");
		
		var headerContainer = $('<div class="prettyPageBody helpPageHeader"></div>');
		var contentContainer = $('<div class="prettyPageBody"></div>');
		this._tab.getContainer().append(
			headerContainer, 
			contentContainer
		);
		
		// Load index
		var indexURL = location.protocol +'//'+ location.host + (location.pathname ? location.pathname : '') + 'ui/app/doc/index.html';
		jQuery.get(indexURL, function(data) {
			headerContainer.html(data);
		})
		.fail(function(err) {
			headerContainer.html(err.responseText);	
		});
		
		// Load help page
		if (docpage) {
			var baseURL = location.protocol +'//'+ location.host + (location.pathname ? location.pathname : '') + 'ui/app/doc/' + docpage + '.html';
			jQuery.get(baseURL, function(data) {
				contentContainer.html(data);
			})
			.fail(function(err) {
				contentContainer.html(err.responseText);	
			}); 
		}
	}
}