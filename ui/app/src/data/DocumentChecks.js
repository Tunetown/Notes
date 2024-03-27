/**
 * Actions for document checks.
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

class DocumentChecks {
	
	#app = null;
	
	constructor(app) {
		this.#app = app;
	}
	
	/**
	 * Check documents basic props
	 */
	async checkDocumentsData(allDocs) {
		var errors = [];
		var cnt = 0;
		
		for(var i in allDocs.rows) {
			var doc = allDocs.rows[i].doc;
			
			if (doc._id.startsWith('_')) continue;
			if (doc._id == 'settings') continue;
			if (doc._id == MetaActions.metaDocId) continue;
			
			cnt++;
			Document.checkBasicProps(doc, errors, allDocs.rows);
		}
		
		if (!errors.length) {
			errors.push({
				message: 'No inconsistent documents found (' + cnt + ' checked)',
				messageThreadId: 'CheckMetaMessages',
				type: 'S'
			});
		}
		
		return {
			numChecked: cnt,
			errors: errors,
		};
	}
	
	/**
	 * Solve errors from the list of solverReceipts in the errors array.
	 */
	async solveDocumentErrors(errors) {
		var ids = [];
		for(var m in errors) {
			var msg = errors[m];
			if (!msg.id) continue;
			if (!msg.solverReceipt && !msg.solver) continue;
			
			ids.push(msg.id);
		}
		ids = Tools.removeDuplicates(ids);

		var docs = [];
		var db;

		var db = await this.#app.db.get();

		var data = await db.allDocs({
			include_docs: true,
			keys: ids,
		});

		for(var i in data.rows) {
			var doc = data.rows[i].doc;
			
			for(var m in errors) {
				var msg = errors[m];
				if (msg.id != doc._id) continue;
				if (!msg.solverReceipt && !msg.solver) continue;
				
				// Repair stuff
				console.log(' -> Repairing document basic data: ' + doc._id);
				Document.repairBasicData(doc, msg.solverReceipt, msg.solver);
			}
			
			docs.push(doc);
		}
		
		if (docs.length == 0) throw new Error('No documents to repair.');
		
		var resp = await db.bulkDocs(docs);
		
		return {
			ok: resp.ok,
			message: resp.message ? resp.message : ('Repaired ' + docs.length + ' documents'),
			messageThreadId: 'SolveErrorsMessages'
		};
	}
	
	/**
	 * Check documents metadata
	 */
	async checkDocumentsMeta(allDocs) {
		var errors = [];
		var cnt = 0;
		
		for(var i in allDocs.rows) {
			var doc = allDocs.rows[i].doc;
			
			if (doc._id.startsWith('_')) continue;
			if (doc._id =='settings') continue;
			if (doc._id == MetaActions.metaDocId) continue;
		
			cnt++;
			Document.checkMeta(doc, errors);
		}
		
		if (!errors.length) {
			errors.push({
				message: 'No inconsistent documents found (' + cnt + ' checked)',
				messageThreadId: 'CheckMetaMessages',
				type: 'S'
			});
		}
		
		return {
			numChecked: cnt,
			errors: errors,
		};
	}
	
	/**
	 * Re-generate all documents meta data
	 */
	async repairDocumentsMeta(ids) {
		var docs = [];
		var db = await this.#app.db.get();

		var data = await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: ids,
		});

		for(var i in data.rows) {
			var doc = data.rows[i].doc;
			if (!doc.type || !Document.isTypeValid(doc.type)) continue;
			
			Document.updateMeta(doc);
			
			console.log(' -> Update metadata for ' + doc._id);
			docs.push(doc);
		}
		
		if (docs.length == 0) throw new Error('No documents to update.');
		
		var resp = await db.bulkDocs(docs);

		return {
			ok: resp.ok,
			message: resp.message ? resp.message : ('Solved problems for ' + docs.length + ' documents'),
			messageThreadId: 'RepairMetaMessages'
		};
	}
	
	/**
	 * Check documents basic props
	 */
	async checkDocumentsConflicts(allDocs) {
		var errors = [];
		
		for(var i in allDocs.rows) {
			var doc = allDocs.rows[i].doc;
			
			if (doc._conflicts) {
				for (var c in doc._conflicts) {
					errors.push({
						message: 'Confict detected: ' + doc._conflicts[c],
						messageThreadId: 'CheckConflictMessages',
						id: doc._id,
						type: 'E'
					});
				}
			}
		}
		
		if (!errors.length) {
			errors.push({
				message: 'No conflicted documents found (' + allDocs.rows.length + ' checked)',
				messageThreadId: 'CheckConflictMessages',
				type: 'S'
			});
		}
		
		return {
			numChecked: allDocs.rows.length,
			errors: errors,
		};
	}
	
	
	/**
	 * Repair documents basic props
	 */
	async repairDocumentsConflicts(ids) {
		var docRevs = [];

		var db = await this.#app.db.get();

		var data = await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: ids,
		});

		for(var i in data.rows) { 
			var doc = data.rows[i].doc;
			
			if (doc._conflicts) {
				for (var c in doc._conflicts) {
					docRevs.push({
						id: doc._id,
						rev: doc._conflicts[c]
					});
				}
			}
		}
		
		for(var i in docRevs) {
			var r = docRevs[i];
			console.log(" -> Deleting conflict revision of " + r.id + ": " + r.rev);
			
			await db.remove(r.id, r.rev);
		}
		
		return {
			ok: true,
			message: 'Deleted ' + docRevs.length + ' conflict revisions',
			messageThreadId: 'DeleteConflictMessages'
		};
	}
	
	/**
	 * Check documents tree referencing
	 */
	async checkDocumentsRefs(allDocs) {
		var errors = [];
		var cnt = 0;
		
		for(var i in allDocs.rows) {
			var doc = allDocs.rows[i].doc;
			if (doc._id.startsWith('_')) continue;
			if (doc._id =='settings') continue;
			if (doc._id == MetaActions.metaDocId) continue;
			
			cnt++;
			if (!doc.type) {
				errors.push({
					message: 'Type missing (document is not displayed)',
					messageThreadId: 'CheckRefsMessages',
					id: doc._id,
					type: 'E'
				});	
			}
			
			if (doc.type == 'reference') {
				if (!doc.ref) {
					errors.push({
						message: 'Ref missing for reference document',
						messageThreadId: 'CheckRefsMessages',
						id: doc._id,
						type: 'E'
					});	
				} else {
					if (!this.#checkRefsDocExists(allDocs.rows, doc.ref)) {
						errors.push({
							message: 'Broken reference: Target ' + doc.ref + ' does not exist',
							messageThreadId: 'CheckRefsMessages',
							id: doc._id,
							type: 'E'
						});	
					}
					
					var refChildren = this.#getRefChidren(allDocs.rows, doc._id);
					for (var rr in refChildren) {
						errors.push({
							message: 'Child of reference document detected: ' + refChildren[rr]._id,
							messageThreadId: 'CheckRefsMessages',
							id: refChildren[rr]._id,
							type: 'E',
							solverReceipt: [{
								action: 'setProperty',
								propertyName: 'parent',
								propertyValue: ''
							}]
						});	
					}
				}
			}
			
			if (!doc.deleted) {
				this.#checkHasRoot(allDocs.rows, doc, errors, doc._id);
			}
		}
		
		var ok = errors.length == 0;
		if (ok) {
			errors.push({
				message: 'No inconsistent documents found (' + cnt + ' checked)',
				messageThreadId: 'CheckRefsMessages',
				type: 'S'
			});
		}
		
		return {
			numChecked: cnt,
			errors: errors,
		};
	}
	
	/**
	 * Checks if id exists in docs. 
	 * Helper for checkDocumentsRefs().
	 */
	#checkRefsDocExists(docs, id) {
		for(var i in docs) {
			var doc2 = docs[i].doc;
			if (doc2._id == id) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Gets Children of an ID.
	 * Helper for checkDocumentsRefs().
	 */
	#getRefChidren(docs, id) {
		var ret = [];
		for(var i in docs) {
			var doc2 = docs[i].doc;
			if (doc2.parent == id) {
				ret.push(doc2);
			}
		}
		return ret;
	}
	
	/**
	 * Helper for checkDocumentsRefs().
	 */
	#checkHasRoot(docs, doc, errors, docId) {
		if (!doc.hasOwnProperty('parent')) {
			errors.push({
				message: 'Parent missing (document is not displayed)',
				messageThreadId: 'CheckHasRootMessages',
				id: doc._id,
				type: 'E'
			});	
			return false;
		}
		if (doc.parent == '') return true;
			
		if (doc.parent == doc._id) {
			errors.push({
				message: 'Self-referencing parent',
				messageThreadId: 'CheckHasRootMessages',
				id: doc._id,
				type: 'E'
			});	
			return false;
		}
		
		for(var i in docs) {
			if (docs[i].doc.deleted) continue;
			
			if (docs[i].doc._id == doc.parent) {
				return this.#checkHasRoot(docs, docs[i].doc, errors, docId);
			}
		}
		
		errors.push({
			message: 'Document has no root: (lost at ' + doc._id + ')',
			messageThreadId: 'CheckHasRootMessages',
			id: docId,
			type: 'E',
			solverReceipt: [{
				action: 'setProperty',
				propertyName: 'parent',
				propertyValue: ''
			}]
		});
		
		return false;
	} 
}