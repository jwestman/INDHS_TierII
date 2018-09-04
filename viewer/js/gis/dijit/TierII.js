define([
  'dojo/_base/declare',
  'dijit/_WidgetBase',

  'dojo/_base/lang',
  'dojo/json',
  'dojo/string',
  'dojo/_base/array',
  'dojo/dom-construct',
  'dojo/topic',

  'dojo/text!./TierII/reports/report.html',
  'dojo/text!./TierII/testdata/data.json',

  './TierII/libs/Blob',
  './TierII/libs/FileSaver'
], function (
  declare, _WidgetBase,
  lang, json, string, array, domConstruct, topic,
  reportTemplate, testData
 ) {

  return declare([_WidgetBase], {

    _started: false,
    _topicString: 'generateReport',

    postCreate: function () {
      this.inherited(arguments);

      // subscribe to "generateReport" optional-reportTemplate, optional-jsonFeatures, optional-reportName
      this.own(topic.subscribe(this._topicString, lang.hitch(this, this.generateReport)));
   },

    startup: function () {
      console.log('TierII Startup');
      this._started = true;
    },

    generateReport: function (report, data, outName) {
      report = report || reportTemplate;
      data = data || testData;
      outName = outName || 'report.html';
            
      data = json.parse(data);
      console.log('Tier-II Features: ' + data.features.length);

      var lines = report.split('\n');
      var line;
      var output = "";
      var chemTemplate;
      var regTemplate;

      for (var x in lines) {
        line = lines[x];
        // check for chemRows
        if (line.indexOf('**chemRows**') > -1) {
          // get template after flag chemRow
          chemTemplate = line.substring(line.indexOf('**chemRows**') + '**chemRows**'.length);
          for (var f in data.features) {
            // compute comp_ehs based on IsEHS
            data.features[f].attributes.comp_ehs = data.features[f].attributes.IsEHS === 0 ? 'Non-EHS' : 'EHS';
            line = string.substitute(chemTemplate, data.features[f].attributes);
            output += line;
          }
          // check for regRows
        } else if (line.indexOf('**regRows**') > -1) {
          // get template after flag regRows
          regTemplate = line.substring(line.indexOf('**regRows**' + '**regRows**'));

          // regular row of template row
        } else {
          if (lines[x].indexOf('${') > -1) {
            line = string.substitute(lines[x], data.features[0].attributes);
            output += line;
          } else {
            output += line;
          }
        }
      }

      var blob = new Blob([output], { type: "text/html;charset=utf-8" });
      saveAs(blob, outName);
    },

    noComma: null
  });
});