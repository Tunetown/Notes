/**
 * References of a document
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
class RefsPage extends Page {
	
	#current = null;

	/**
	 * Tells that the editor needs tree data loaded before load() is called.
	 */
	needsHierarchyData() {
		return true;
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current ? this.#current : null;
	}
	
	/**
	 * Unload instance
	 */
	async unload() {
		this.#current = null;
	}

	/**
	 * Show trash bin
	 */
	async load(id) {
		var doc = this._app.data.getById(id);
		if (!doc) {
			this._app.view.message('Document ' + id + ' not found');
			return;
		}
		
		this.#current = doc;
		
		// Set note name in the header bar
		this._tab.setStatusText("References to " + doc.name);
		
		// Get refs to doc
		var refs = this._app.data.getReferencesTo(id);
		
		// Build table
		var rows = new Array();
		
		var that = this;
		for(var i in refs) {
			var ref = refs[i];
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Delete Reference" class="fa fa-trash versionButton" data-id="' + ref._id + '"/>')
					.on('click', function(e) {
						var rid = $(this).data().id;
						
						that._app.view.triggers.triggerDeleteItem([rid])
						.then(function() {
							that._app.routing.call('refs/' + id);
						})
						.catch(function(err) {
							that._app.errorHandler.handle(err);
						});
					})
				]
			);
			
			rows.push(
				$('<tr>').append(
					[
						$('<td style="cursor: pointer;" data-id="' + ref._id + '">' + this._app.data.getReadablePath(ref._id) + '</td>')
						.on('click', function(e) {
							var id = $(this).data().id;
							that._app.nav.focus(id);
						}),
						$('<td data-ts="' + ref.timestamp + '">' + new Date(ref.timestamp).toLocaleString() + '</td>'),
						$('<td/>').append(
							butts
						),
					]					
				)
			);
		}
		
		var refsTable = $('<table class="table table-striped table-hover" />'); 

		this._tab.getContainer().append(
			refsTable.append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Reference</th>'),
								$('<th scope="col">Last Changed</th>'),
								$('<th scope="col">Actions</th>'),
							]
						)
					),
					$('<tbody/>').append(rows),
				]
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
		);
		
		Tools.makeTableSortable(refsTable, {
			excludeColumns: [2],
			sortData: [
				{
					colIndex: 1,
					getValue: function(td) {
						return $(td).data().ts;
					}
				}
			]
		});
	}
}