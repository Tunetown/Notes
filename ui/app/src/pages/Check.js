/**
 * Check page
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
class Check {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Check.instance) Check.instance = new Check();
		return Check.instance;
	
	}

	constructor() {
		var that = this;
		this.checks = new Map([
			['ddocCheck', {
				description: 'Views consistency',
				runner: function(onFinish) {
					that.processCheck(
						Views.getInstance().checkViews(),
						onFinish
					);
				},
				solver: function(ids, errors) {
					return Views.getInstance().updateViews();
				}
			}],
			['settingsCheck', {
				description: 'Settings consistency',
				runner: function(onFinish) {
					that.processCheck(
						SettingsActions.getInstance().checkSettings(),
						onFinish
					);
				}
			}],
			['unnecessaryDdocCheck', {
				description: 'Unnecessary views',
				runner: function(onFinish) {
					that.processCheck(
						Views.getInstance().checkUnusedViews(),
						onFinish
					);
				},
				solver: function(ids, errors) {
					return Views.getInstance().deleteUnusedViews();
				}
			}],
			['basicCheck', {
				usesAllDocs: true,
				description: 'Document Integrity',
				runner: function(onFinish, allDocs) {
					that.processCheck(
						DocumentChecks.getInstance().checkDocumentsData(allDocs),
						onFinish
					);
				},
				solver: function(ids, errors) {
					return DocumentChecks.getInstance().solveDocumentErrors(errors);
				}
			}],
			['metaCheck', {
				usesAllDocs: true,
				description: 'Document Metadata',
				runner: function(onFinish, allDocs) {
					that.processCheck(
						DocumentChecks.getInstance().checkDocumentsMeta(allDocs),
						onFinish
					);
				},
				solver: function(ids, errors) {
					return DocumentChecks.getInstance().repairDocumentsMeta(ids);
				}
			}],
			['treeDocsCheck', {
				usesAllDocs: true,
				description: 'Tree structure integrity',
				runner: function(onFinish, allDocs) {
					that.processCheck(
						DocumentChecks.getInstance().checkDocumentsRefs(allDocs),
						onFinish
					);
				}
			}],
			['conflictsCheck', {
				usesAllDocs: true,
				description: 'Conflicts',
				runner: function(onFinish, allDocs) {
					that.processCheck(
						DocumentChecks.getInstance().checkDocumentsConflicts(allDocs),
						onFinish
					);
				},
				solver: function(ids, errors) {
					return DocumentChecks.getInstance().repairDocumentsConflicts();
				}
			}],
			['syncChecks', {
				description: 'Local/Remote consistency',
				runner: function(onFinish) {
					that.processCheck(
						Database.getInstance().syncHandler.checkConsistency(function(msg, type) {
							Console.log(msg, type);
						}),
						onFinish
					);
				},
				solver: function(ids, errors) {
					Database.getInstance().syncHandler.syncManually();
					return Promise.resolve({
						dontRunCheck: true
					});
				}
			}],
			['statistics', {
				usesAllDocs: true,
				description: 'Document Size Statistics',
				runner: function(onFinish, allDocs) {
					that.processCheck(
						DocumentAccess.getInstance().getStats(allDocs),
						onFinish
					);
				}
			}],
		]);
		
		for (const [name, check] of this.checks.entries()) {
			check.name = name;
		}
	}
	
	/**
	 * Show page
	 */
	load() {
		var n = Notes.getInstance();
		n.setCurrentPage(this);
		
		var checkRows = [];
		for (const [name, check] of this.checks.entries()) {
			checkRows.push(
				this.getRow(check)
			);
		}
		
		$('#contentContainer').append(
			$('<table class="table table-striped table-hover" />').append(
				[
					$('<thead class="bg-primary"/>').append(
						$('<tr/>').append(
							[
								$('<th scope="col">Status</th>'),
								$('<th scope="col">Check</th>'),
								$('<th scope="col">Actions</th>'),
								$('<th scope="col">Results</th>'),
							]
						)
					),
					$('<tbody/>').append(
						checkRows
					),
				]
			),
			$('<br>'),
			$('<br>'),
			$('<br>'),
			$('<div id="checkList" />')
		);
		
		// Set note name in the header bar
		n.setStatusText("Database Consistency Check");

		// Buttons
		n.setButtons([ 
			$('<div id="closeMsgButton" type="button" data-toggle="tooltip" title="Close message list" class="fa fa-times" onclick="event.stopPropagation();Check.getInstance().closeMessages()"></div>'), 
			$('<div id="runAllButton" type="button" data-toggle="tooltip" title="Run all checks" class="fa fa-play" onclick="event.stopPropagation();Check.getInstance().runAll()"></div>'),
		]);
		
		//n.updateDimensions();
		
		$('#closeMsgButton').css('display', 'none');
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Runs a check. This can be called from anyone. Returns a promise.
	 */
	runCheck(check) {
		// Hide play button
		$('#checkButton_' + check.name).css('display', 'none');
		$('#listButton_' + check.name).css('display', 'none');
		$('#solveButton_' + check.name).css('display', 'none');
		
		// Set status to running
		this.setStatus(check.name, 'running');
		this.setOutputText(check.name, 'Running...'); 

		// Start processing
		var that = this;
		return new Promise(function(resolve, reject) {
			/**
			 * Callback which MUST be called by the callbacks before returning.
			 */
			function onFinish(status, outputText, messages) {
				if (outputText) that.setOutputText(check.name, outputText); 
				if (status) that.setStatus(check.name, status);
				
				$('#checkButton_' + check.name).css('display', 'block');
				$('#listButton_' + check.name).css('display', (messages && messages.length) ? 'block' : 'none');
				$('#solveButton_' + check.name).css('display', 'block'); //check.solver ? 'block' : 'none');
				
				that.checks.get(check.name).messages = messages;
				
				resolve({
					ok: true
				});
			}
			
			// Call callbacks, passing the event and the onFinish callback.
			if (check.usesAllDocs) {
				if (that.allDocs) {
					// Use the current allDocs buffer, if existent.
					check.runner(onFinish, that.allDocs);
				} else {
					// Get all docs beforehand
					DocumentAccess.getInstance().getAllDocs()
					.then(function(all) {
						check.runner(onFinish, all);
					})
					.catch(function(err) {
						reject(err);
					});
				}
			} else {
				// Run directly
				check.runner(onFinish);
			}
		});
	}
	
	/**
	 * Run all checks. Returns a promise holding all checks promise returns.
	 */
	runAll() {
		// Get all documents, then run tests on it.
		var that = this;
		DocumentAccess.getInstance().getAllDocs()
		.then(function(all) {
			that.allDocs = all;
			
			// Run checks
			var ret = [];
			for (const [name, check] of that.checks.entries()) {
				ret.push(
					that.runCheck(
						check 
					) 
				);
			}
			
			return Promise.all(ret);
		})
		.then(function(data) {
			// Clear allDocs buffer again.
			that.allDocs = null;
			
			return Promise.resolve(data);
		});
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Processes a check returning ok flag and errors array. This is called in the check definitions to 
	 * generalize error handling.
	 */
	processCheck(promise, onFinish) {
		var that = this;

		function evalReturn(res, status) {
			var txt = '';
			if (res.message) {
				txt += res.message + '<br>';
			}
			var ev = that.evaluateErrors(res);
			txt += ev.summary;
		
			onFinish(status ? status : (ev.status ? ev.status : 'error'), txt, res.errors);
		}
		
		return promise.then(function(res) {
			evalReturn(res);
		})
		.catch(function(res) {
			evalReturn(res); 
		});
	}
	
	/**
	 * Returns an object with evaluated errors.
	 */
	evaluateErrors(res) {
		if (!res.errors) {
			return {
				status: 'error',
				summary: 'Error: ' + JSON.stringify(res)
			}
		}
		
		var ret = {
			numErrors: 0,
			numWarnings: 0,
			numInfo: 0,
			numSuccess: 0,
			docsChecked: res.numChecked ? res.numChecked : 0,
		}

		var s = 0;
		for(var e in res.errors) {
			var error = res.errors[e];
			
			if (!error.type) {
				ret.numErrors++;
				if (s < 2) s = 2;
			} else {
				switch(error.type) {
				case 'E': 
					ret.numErrors++;
					if (s < 2) s = 2;
					break;
				case 'W': 
					ret.numWarnings++;
					if (s < 1) s = 1;
					break;
				case 'I': 
					ret.numInfo++;
					break;
				case 'S': 
					ret.numSuccess++;
					break;
				} 
			}
		}
		
		switch(s) {
		case 0: ret.status = 'ok'; break;
		case 1: ret.status = 'warning'; break;
		case 2: ret.status = 'error'; break;
		}
		
		ret.summary = ret.numErrors + ' Errors, ' + ret.numWarnings + ' Warnings (' + res.errors.length + ' Messages from ' + ret.docsChecked + ' checked documents)';
		
		return ret;
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Generate a DOM row holding a check.
	 */
	getRow(check) { 
		var that = this;
		return $('<tr id="' + check.name + '"></tr>').append([
			$('<th scope="row"><span class="fa fa-question-circle iconGrey trashitemicon"></span></th>'),
			$('<td>' + check.description + '</td>'),
			$('<td></td>').append(
				this.getListOption(check),
				this.getRunOption(check),
				this.getSolveOption(check),
			),
			$('<td class="checkOutput"></td>')
			.on('click', function(e) {
				e.stopPropagation();
				
				that.showMessages(check);
			})
		]);
	}
	
	/**
	 * Generates a run button.
	 */
	getRunOption(check) {
		var that = this;
		return $('<div data-toggle="tooltip" title="Run check" class="fa fa-play versionButton" id="checkButton_' + check.name + '"/>')
		.on('click', function(e) {
			e.stopPropagation();

			that.allDocs = null;
			that.runCheck(check);
		});
	}

	/**
	 * Generates a list button.
	 */
	getListOption(check) {
		var that = this;
		return $('<div data-toggle="tooltip" title="Display log" class="fa fa-list versionButton" style="display: none;" id="listButton_' + check.name + '"/>')
		.on('click', function(e) {
			e.stopPropagation();
			
			that.showMessages(check);
		});
	}
	
	/**
	 * Generates a list button.
	 */
	getSolveOption(check) {
		var that = this;
		//if (!check.solver) return null;
		
		return $('<div data-toggle="tooltip" title="Solve problems" class="fa fa-syringe versionButton" style="display: none;" id="solveButton_' + check.name + '"/>')
		.on('click', function(e) {
			e.stopPropagation();
			
			that.solve(check);
		});
	}
	
	/**
	 * Solve problems.
	 */
	solve(check) {
		// Global solver, if any
		if (check.solver) return this.solveGlobal(check);
		
		if (!confirm('Try to solve problems?\n\n')) return Promise.reject();
		
		// Run individula solvers
		console.log('Running individual solvers for check ' + check.description);
		
		var promises = [];
		for(var m in check.messages) {
			promises.push(DocumentChecks.getInstance().solveDocumentErrors([check.messages[m]]));
		}
		
		return Promise.all(promises) 
		.then(function() {
			return TreeActions.getInstance().requestTree();
		})
		.then(function() {
			Notes.getInstance().showAlert('Solved ' + promises.length + ' problems.', 'I');
		})
		.catch(function(err) {
			Notes.getInstance().showAlert(err.message, 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Call the check's solver
	 */
	solveGlobal(check) {
		if (!check.solver) return Promise.reject();
		
		console.log('Running global solver for check ' + check.description);
		
		var ids = [];
		for(var m in check.messages) {
			var msg = check.messages[m];
			if (!msg.id) continue;
			if (msg.type == 'S') continue;
			if (msg.type == 'I') continue;
			
			ids.push(msg.id);
		}
		ids = Tools.removeDuplicates(ids);

		if (ids.length == 0) {
			Notes.getInstance().showAlert('No documents to solve.');
			return Promise.resolve();
		}
		
		var docsList = '';
		for(var i in ids) {
			docsList += ids[i] + '\n';
		}
		if (!confirm('Try to solve problems with ' + ids.length + ' documents?\n\n' + docsList)) return Promise.reject();
		
		var that = this;
		return check.solver(ids, check.messages)
		.then(function(data) {
			Notes.getInstance().showAlert((data && data.message) ? data.message : 'Solving finished.', 'S');
			if (data.dontRunCheck) return Promise.resolve();
			return that.runCheck(check);
		})
		.then(function() {
			return TreeActions.getInstance().requestTree();
		})
		.catch(function(err) {
			Notes.getInstance().showAlert((err && err.message) ? err.message : 'Error solving problems.', 'E');
			if (err.dontRunCheck) return Promise.resolve();
			return that.runCheck(check);
		});
	}
	
	/**
	 * Show message s for a check
	 */
	showMessages(check) {
		$('#runAllButton').css('display', 'none');
		$('#closeMsgButton').css('display', 'block');
		
		Notes.getInstance().setStatusText('Results of: ' + check.description);
		
		this.displayResults(check);
	}
	
	/**
	 * Close message list
	 */
	closeMessages() {
		$('#checkList').css('display', 'none');
		
		$('#runAllButton').css('display', 'block');
		$('#closeMsgButton').css('display', 'none');
		
		Notes.getInstance().setStatusText("Database Consistency Check");
	}
	
	/**
	 * Display results of the passed check.
	 */
	displayResults(check) {
		$('#checkList').css('display', 'block');
		
		new CheckList($('#checkList'), check);
	}

	/**
	 * Set the output text of a row.
	 */
	setOutputText(rowId, text) {
		$('#' + rowId + ' .checkOutput').html(text)
	}

	/**
	 * Set the status icon of a row.
	 */
	setStatus(rowId, status) {
		var icon = $('#' + rowId + ' .trashitemicon');
		icon.removeClass();
		icon.addClass('trashitemicon ' + this.getStatusIcon(status));
	}
	
	/**
	 * Get icon classes for the passed status.
	 */
	getStatusIcon(status) {
		switch(status) {
		case 'running': return 'fa fa-running';
		case 'unknown': return 'fa fa-question-circle iconGrey';
		case 'warning': return 'fa fa-exclamation-circle iconOrange';
		case 'error': return 'fa fa-exclamation-circle iconRed';
		case 'ok': return 'fa fa-check-circle iconGreen';
		}
		throw new Error('Invalid status: ' + status);
	}
}