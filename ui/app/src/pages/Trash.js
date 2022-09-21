/**
 * Trash Bin
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
class Trash {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Trash.instance) Trash.instance = new Trash();
		return Trash.instance;
	}
	
	/**
	 * Show trash bin
	 */
	load(docs) {
		var n = Notes.getInstance();
				
		// Build new table from the data
		var rows = new Array();
		var allSize = 0;
		for(var i in docs || []) {
			var doc = docs[i].doc;
			var butts = $('<span class="listOptionContainer" />').append(
				[
					$('<div data-toggle="tooltip" title="Restore Note" class="fa fa-redo versionButton" data-name="' + doc.name + '"id="vref_' + doc._id + '"/>')
					.on('click', function(e) {
						var id = $(this).attr('id').substring('vref_'.length);
						DocumentActions.getInstance().undeleteItem(id)
						.then(function(data) {
							if (data.message) Notes.getInstance().showAlert(data.message, 'S', data.messageThreadId);
							Notes.getInstance().routing.call('trash');
						})
						.catch(function(err) {
							Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
						});
					}),
					$('<div data-toggle="tooltip" title="Delete permanently" class="fa fa-trash versionButton" data-name="' + doc.name + '" id="vref_' + doc._id + '"/>')
					.on('click', function(e) {
						var id = $(this).attr('id').substring('vref_'.length);
						
						DocumentActions.getInstance().deleteItemPermanently(id)
						.then(function(data) {
							if (data.message) {
								Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
							}
						}).catch(function(err) {
							Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
						});
					})
				]
			);
		
			var icon = "";
			switch(doc.type) {
			case "note":
				icon = 'fa fa-file';
				break;
			case "attachment":
				icon = 'fa fa-paperclip';
				break;
			}
			
			var parent = doc.parent;
			var parentDoc = n.getData().getById(doc.parent);
			if (parentDoc) parent = parentDoc.name;
			
			var vSize = this.getVersionsSize(Document.getAttachments(doc));
			var cSize = Document.getContent(doc) ? Document.getContent(doc).length : 0;
			allSize += vSize + cSize;
			
			var numVersions = this.countVersions(Document.getAttachments(doc));
			
			rows.push(
				$('<tr>').append(
					[
						$('<td><span class="' + icon + ' trashitemicon"></span>' + doc.name + '</td>'),
						$('<td>' + parent + '</td>'),
						$('<td data-num="' + numVersions + '">' + numVersions + '</td>'),
						$('<td data-size="' + (vSize + cSize) + '">' + Tools.convertFilesize(vSize + cSize) + '</td>'),
						$('<td/>').append(butts),
					]					
				)
			);
		}
			
		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" id="trashTable" />').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">ID</th>'),
								$('<th scope="col">Parent</th>'),
								$('<th scope="col">#Versions</th>'),
								$('<th scope="col">Versions Size</th>'),
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
		
		Tools.makeTableSortable($('#trashTable'), {
			excludeColumns: [4],
			sortData: [
				{
					colIndex: 2,
					getValue: function(td) {
						return $(td).data().num;
					}
				},
				{
					colIndex: 3,
					getValue: function(td) {
						return $(td).data().size;
					}
				}
			]
		});
		
		// Set note name in the header bar
		n.setStatusText("Trash Bin (" + Tools.convertFilesize(allSize) + ")");

		// Buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Empty trash bin" class="fa fa-trash" onclick="event.stopPropagation();Trash.getInstance().emptyTrash()"></div>') 
		]);
	}
	
	getVersionsSize(atts) {
		var cnt = 0;
		for (var prop in atts) {
		    if (Object.prototype.hasOwnProperty.call(atts, prop)) cnt += atts[prop].length;
		}
		return cnt;
	}
	
	countVersions(atts) {
		var cnt = 0;
		for (var prop in atts) {
			if (Object.prototype.hasOwnProperty.call(atts, prop)) cnt++;
		}
		return cnt;
	}
	
	emptyTrash() {
		TrashActions.getInstance().emptyTrash()
		.then(function(data) {
			if (data.message) {
				Notes.getInstance().showAlert(data.message, "S", data.messageThreadId);
			}
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
}