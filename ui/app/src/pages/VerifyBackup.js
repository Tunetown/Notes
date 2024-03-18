/**
 * VerifyBackup page.
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
class VerifyBackup {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!VerifyBackup.instance) VerifyBackup.instance = new VerifyBackup();
		return VerifyBackup.instance;
	}
	
	/**
	 * Verify backup files.
	 */
	load() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		n.setStatusText("Verify Backups");
		
		var headerContainer = $('<div class="prettyPageBody helpPageHeader"></div>'); 
		this.contentContainer = $('<div class="prettyPageBody"></div>');
		$('#contentContainer').empty(); 
		$('#contentContainer').append(
			headerContainer,
			this.contentContainer  
		);
		
		var that = this;
		headerContainer.append( 
			$('<div></div>').append(
				$('<div></div>').text('Verify backup (Raw JSON file) against current database: '),
				$('<br>'),
				$('<input type="file" class="form-control" id="importVerificationFile" />'),
				$('<br>'),
				$('<button type="button" class="btn btn-primary" id="importVerificationFileButton">Verify!</button>').on('click', function(e) {
					e.stopPropagation();
					
					that.showDiff();
				}),
				$('<br>'),
				$('<br>'),
			),
		);
		 
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Select notebook..." class="fa fa-home" onclick="event.stopPropagation();Notes.getInstance().routing.callSelectProfile();"></div>'),
		]);
	}
	
	showDiff() {
		if (!this.contentContainer) return;
		var n = Notes.getInstance();
		
		n.showAlert('Started verification, please wait', 'I', 'VerifyProcessMessages');
		
		
		var file = $('#importVerificationFile')[0].files[0];
    		
		if (!file) {
			n.showAlert('Please select a file to verify.', 'I', 'VerifyProcessMessages');
			return;
	    }
    		
		console.log('File Import: Loading ' + file.name, 'I');
			
		var that = this;
		setTimeout(function() {
			that.#doShowDiff(file)
			.catch(function(err) {
				n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
			});
		}, 100);
	}
	
	#doShowDiff(file) {
		if (!this.contentContainer) return Promise.reject();
		
		//var n = Notes.getInstance();
		var dataLocal;
		
		this.contentContainer.empty();

		var that = this;
		return Database.getInstance().get()
		.then(function(db) {
			return db.allDocs({
				include_docs: true,
				attachments: true,
				conflicts: true
			});
		})
		.then(function(dl) {
			dataLocal = dl;
			
			return new Promise(function(resolve, reject) {
				if (!file) {
					reject({
						message: 'No file selected',
						messageThreadId: 'VerifyProcessMessages'					
					});
				}
				
				var reader = new FileReader();
				reader.onload = function() {
					resolve({
						ok: true,
						json: reader.result
					});
				}
				
				reader.readAsText(file);
			});
		})
		.then(function(data) {
			console.log('Received ' + Tools.convertFilesize(data.json.length) + ' of data from ' + file.name, 'I');
			
			return that.#getDiff(dataLocal, data.json, file.name); 
		})
		.then(function(data) {
			if (!data || !data.diff) return Promise.reject({
				message: "No data received from comparison tool"
			});

			var diffRows = [];
			for(var [key, diffForId] of data.diff) {
				diffRows.push(
					$('<tr>').append([
						$('<td colspan="2" class="tableAlignMiddle bg-primary" data-id="' + key + '">' + key + ' (' + diffForId.length + ' problems)</td>')
						.on('click', function(e) {
							e.stopPropagation();
							
							var hid = $(this).data('id');
							
							$('#verifyTab').find('.verifyRowDetail').each(function() {
								if ($(this).data('id') == hid) {
									$(this).css('display', ($(this).css('display') == 'none') ? 'block' : 'none');									
								}
							})
						}),
					])
				);
				
				for (var d in diffForId) {
					diffRows.push(
						$('<tr class="verifyRowDetail" data-id="' + key + '" style="display: none">').append([
							$('<td class="tableAlignMiddle">' + diffForId[d].type + '</td>'),
							$('<td class="tableAlignMiddle">' + diffForId[d].message + '</td>'),
						])
					);
				}
			}
			
			if (diffRows.length == 0) {
				diffRows.push(
					$('<tr>').append([
						$('<td colspan="2" class="tableAlignMiddle">No differences found in ' + data.docs.length + ' documents</td>')
					])
				);
			}
						
			that.contentContainer.append(
				$('<table class="table table-striped table-hover" id="verifyTab"/>').append(
					[
						$('<thead class="bg-primary"/>').append(
							$('<tr/>').append(
								[
									$('<th colspan="2">Differences (Local - Imported)</th>'),
								]
							)
						),
						$('<tbody/>').append(diffRows),
					]
				)
			);

			return Promise.resolve({
				ok: true
			}) 
		})
	}
	
	#getDiff(dataLocal, jsonString, sourceName) {
		if (!jsonString) {
			return Promise.reject({
				message: 'No data to import',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		if (!sourceName) {
			return Promise.reject({
				message: 'No root item name to import to',
				messageThreadId: 'ImportProcessMessages'
			});
		}
		
		var imported = JSON.parse(jsonString);
		var diff = new Map();
		
		function addError(id, msg, type) {
			var dd = diff.get(id);
			if (!dd) {
				dd = [];
			}
			
			dd.push({
				message: msg,
				type: type
			});
			
			diff.set(id, dd);
		}
		
		function stripDoc(doc) {
			Document.updateMeta(doc);
			doc = Document.clone(doc);	
			
			delete doc._rev;
			if (!doc.tags) doc.tags = [];
			return doc;
		}
		
		// Check for all imported documents
		for(var i in imported) {
			var docImported = imported[i];
			if (NotesExporter.isDesignDocument(docImported._id)) continue;
			
			var docLocal = null;
			for(var r in dataLocal.rows) {
				var kdoc = dataLocal.rows[r];
				
				if (kdoc.id == docImported._id) {
					docLocal = kdoc.doc;
					break;
				}
			}
			
			if (!docLocal) {
				addError(docImported._id, 'Imported document ' + docImported._id + ' not found locally', 'E');
				continue;
			}
			
			// Compare contents
			var resultList = DatabaseSync.compareDocuments(stripDoc(docLocal), stripDoc(docImported));
			
			for(var l in resultList) {
				addError(docLocal._id, resultList[l].message, resultList[l].type);
			}	
		}	
		
		// Check the other way round (there must not be any docs too much locally)
		for(var r in dataLocal.rows) {
			var doc = dataLocal.rows[r].doc;
			if (NotesExporter.isDesignDocument(doc._id)) continue;
			
			
			var found = false;
			for(var i in imported) {
				var docImported = imported[i];
				if (doc._id == docImported._id) {
					found = true;
					break;
				}
			}
			
			if (!found) {
				addError(doc._id, 'Local document ' + doc._id + ' not found in imported data', 'E');
			}
		}
		
		return Promise.resolve({
			diff: diff,
			docs: imported
		});	
	}
}