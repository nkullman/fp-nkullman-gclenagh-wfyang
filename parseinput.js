/** Parse sieve analysis input files.
 * Expected input files:
 * 	FASTA file with vaccine ID and AA sequence
 * 	FASTA file with breakthrough sequences and IDs
 * 	CSV with seqID:treatment (vaccine/placebo) treatment
 * 	CSV with sequence mismatches (relative to vaccine) for each seqID */

/** 2D-array (of chars) representing AAs at each position in the sequence
 * for the vaccine and each sequence ID */
var sequences_raw = [];
/** Object holding a 2D-array of sequences for both the vaccine and placebo groups */
var sequences = {"vaccine":[], "placebo":[]};
/** Dictionary with sequence IDs as keys and entries for:
 * 		AA sequence (char array),
 * 		distances (dictionary with array for each distance measure)
 * 		vaccine/placebo status (boolean) */
var seqID_lookup = {};
/** Object with vaccine ID and AA sequence */
var vaccine = {};
/** Array with conservation and reference info for each position */
var display_idx_map;
/* Lookup table with index for each hxb2 position*/
var refmap = {};
/** Number of people in the vaccine group */
var numvac = 0;
/** Number of people in the placebo group */
var numplac = 0;
/** Dictionary with wite-level statistics to display in navigation chart.
 * 	Entries are dictionaries for each distance measurement, within which are
 * 		entries that hold a site statistic and its array of values */
var siteStats = {/*EX: vxmatch_site:{placDist: [], vacDist: [], sieve_statistic: [], pval: [], qval: []}*/};
/** Array of p-values */
var pvalues =[];
/** Array of absolute value of t-stats */
var tvalues =[];
/** Array of Entropy Values */
var entropies = {full:[],vaccine:[],placebo:[]};
/**  Object with nests of distances for each distance method */
var dists;

d3.csv("data/VTN502.trt.csv", function(assigndata)
{
	parseTreatmentFile(assigndata);
	d3.text("data/VTN502.gag.MRK.fasta", function(fastadata)
	{
		doseqparsing(fastadata);
		d3.csv("data/VTN502.gag.MRK.vxmatch_site.distance.csv", function(distdata)
		{
			dodistparsing(distdata);
			d3.csv("data/VTN502.gag.MRK.vxmatch_site.results.csv", function(resultdata)
			{
				parseResultsFile(resultdata);
				generateVis();
					
			});
		});
	});	
});

function parseTreatmentFile(assigndata){
	seqID_lookup = d3.nest()
		.key(function(d) {return d.ptid;})
		.rollup(function(d) {
			if (d[0].treatment.toUpperCase().startsWith("P")){
				numplac++;
				return { "distance": {}, "sequence": [], "vaccine": false };
			} else {
				numvac++;
				return { "distance": {}, "sequence": [], "vaccine": true };
			}
		})
		.map(assigndata.filter(function(d){return !d.treatment.toLowerCase().startsWith("ref");}));
}

function doseqparsing(seqdata) {
	var lines = seqdata.split('\n');
	for (var i = 0; i < lines.length; ) {
		if (!lines[i].startsWith(">") || lines[i].length === 0) { i++; }
		else {
			var seqID = lines[i].substr(1).trim(/(\r\n|\n|\r)/gm);
			var seq = lines[i+1].split("");
			while (seq[seq.length-1].charCodeAt(0) < 32) { seq.pop(); }
			sequences_raw.push(seq);
			if (seqID.startsWith("reference"))
			{
				vaccine.sequence = seq;
			} else if ((seqID in seqID_lookup) && seqID_lookup[seqID].vaccine) {
				seqID_lookup[seqID].sequence = seq;
				sequences.vaccine.push(seq);
				numvac++;
			} else if (seqID in seqID_lookup) {
				seqID_lookup[seqID].sequence = seq;
				sequences.placebo.push(seq);
				numplac++;
			}
			i += 2;
		}
	}
}

function dodistparsing(distdata)
{
	dists = d3.nest()
		.key(function(d) {return d.distance_method;})
		.rollup(function(data)
			{
				return d3.nest()
					.key(function(d) { return d.ptid; })
					.rollup(function(d) { return d.map(function(a) {return a.distance;}); })
					.entries(data);
			})
		.entries(distdata);
	display_idx_map = distdata.filter(function (d)
		{
			return d.ptid == distdata[0].ptid && d.distance_method == distdata[0].distance_method;
		}).map(function(d) {return d.display_position;});
	display_idx_map.forEach(function(d, i) {refmap[d] = i;});
}

function parseResultsFile(resultdata){
	
	var statsToDisplay = Object.keys(resultdata[0]).filter(function(d,i){ return i > 2; })
	siteStats = d3.nest()
		.key(function(d) {return d.distance_method;})
		.rollup(function(d){
			var result = {};
			for (var statidx in statsToDisplay){
				var stat = statsToDisplay[statidx];
				result[stat] = d.map(function(a){return +a[stat];});
			}
			return result;
		})
		.map(resultdata);
}

/** Transpose 2D array */
function transpose(array) {
  return array[0].map(function (_, c) { return array.map(function (r) { return r[c]; }); });
}