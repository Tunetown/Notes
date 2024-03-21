/**
 * Shows and stores settings
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
class SettingsPage extends Page {
	
	#content = null;
	
	async unload() {
		this.#content = null;
	}
		
	/**
	 * Loads the passed version history data into the versions view.
	 */
	async load() {
		// Set page name in the header
		this._tab.setStatusText("Settings"); 
		
		// Build settings page
		this.#content = new SettingsContent();
		this._tab.getContainer().append(this.#content.getTable());
		this.#content.update();

		// Build buttons
		var that = this;
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Save Settings" class="fa fa-save"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that._app.settings.save();
			}),
		]);
	}
}