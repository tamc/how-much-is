units = d3.map();
unit_list = undefined;
unit_regular_expression = /\s*(\d+(\.\d+)?([eE]-?\d+)?)\s*(\S*)/;
alias_split_regular_expression = /\s*,\s*/;
output_number_format = d3.format(",.3r");
comparison_number_format = d3.format(".0%");
comparisons = undefined;

d3.tsv("units.tsv", function(data) {
  unit_list = data;

  // First pass sorts out the individual units
  data.forEach(function(d) { 
    // Turn equivalent_to into a quantity and unit
    match = unit_regular_expression.exec(d.equivalent_to);
    d.equivalent_quantity = +match[1];
    d.equivalent_unit = match[4].toLowerCase().trim();

    // Clean up other attributes
    d.name = d.name.trim();
    d.symbol = d.symbol.trim();
    
    // File it in this type according to its symbol, name and aliases
    if(d.symbol.length > 0) {
      units.set(d.symbol.toLowerCase(), d);
    };
    if(d.name.length > 0) {
      units.set(d.name.toLowerCase(), d);
    }
    
    aliases = d.aliases.split(alias_split_regular_expression);
    
    aliases.forEach(function(a) {
      a = a.toLowerCase().trim();
      if(a.length > 0) {
        units.set(a, d);
      };
    });
  });

  // Then we try and put each unit into the fundamental unit for that type
  data.forEach(convertToFunamentalUnit);
  tsvHasLoaded();
});

d3.tsv("comparisons.tsv", function(data) {
  comparisons = data;

  data.forEach(function(d) {
    match = unit_regular_expression.exec(d.equivalent_to);
    d.equivalent_quantity = +match[1];
    d.equivalent_unit = match[4].toLowerCase().trim();

    d.name = d.name.trim();
  });
  
 tsvHasLoaded();

});

// Some processing can only be done when both units.tsv
// and comparison.tsv have been loaded.
tsv_loaded_count = 0;
function tsvHasLoaded() {
  tsv_loaded_count++;
  if(tsv_loaded_count == 2) {
    comparisons.forEach(convertToFunamentalUnit);
    userInput();
  }
}

// To create a fundamental unit, we recursively loop through the equivalent units
// until we can't any more. For example, say we define:
// 1 GJ = 1000 MJ
// 1 MJ = 1000 kJ
// 1 kJ = 1000 J
// 1 J = 1 J
// Then 1 J is the fundamental unit. Converting 1 GJ will in turn become:
// 1 GJ = 1000 MJ = 1000 * 1000 kJ = 1000 * 1000 * 1000 J = 1000 * 1000 * 1000 * 1 J
// and then stop, because 1 J only refers to itself.
function convertToFunamentalUnit(unit) {
  if(unit.fundamental_type == undefined) {
    unit.fundamental_quantity = unit.equivalent_quantity;
    unit.fundamental_unit = unit.equivalent_unit;
  }
  fundamental_unit = units.get(unit.fundamental_unit);
  while( fundamental_unit != undefined) {
    unit.fundamental_quantity = unit.fundamental_quantity * fundamental_unit.equivalent_quantity;
    unit.fundamental_unit = fundamental_unit.equivalent_unit;
    next_fundamental_unit = units.get(unit.fundamental_unit);
    if(fundamental_unit == next_fundamental_unit) {
      break;
    } else {
      fundamental_unit = next_fundamental_unit;
    }
  }
}

inputForm = d3.select('input#input');
inputForm.on('input', userInput);

resultsShown = false;

input_timeout = undefined;

function userInput() {
  // Get what the user wrote
  text = inputForm.node().value;

  // Make it appear in the page title
  document.title = "How much is "+text+"?";

  // Split it into quantitiy and unit
  match = unit_regular_expression.exec(text);
  if(match == undefined) { return clear(); }
  input_quantity = +match[1];
  input_unit_original_case = match[4].trim();
  input_unit = input_unit_original_case.toLowerCase().trim();

  // The user may not have entered a unit yet
  if(input_unit.length == 0) { return clear(); }

  input_unit_object = units.get(input_unit);

  // This waits for 1 second in case the user is typing
  // if, after 1 second, the unit isn't recognised, shows
  // an apology to the user
  clearTimeout(input_timeout);
  input_timeout = setTimeout(checkIfInputRecognised, 1000);

  // The unit may not be recognised
  if(input_unit_object == undefined) { return clear(); }

  showResults();
  window.location.hash = encodeURIComponent(text);
  ga('send', 'pageview', "found/"+window.location.hash.slice(1));

  // Show the unit to the user
  if(input_unit != input_unit_object.name.toLowerCase()) {
    interpretation_text = input_unit_original_case+" is interpreted as "+input_unit_object.name+". " ;
  } else {
    interpretation_text = "";
  }
  d3.select('#input_description .name').html(interpretation_text);
  d3.select('#input_description .description').html(input_unit_object.description);
  
  // If it is, then convert the user input into the fundamental unit
  input_fundamental_quantity = input_quantity * input_unit_object.fundamental_quantity;
  input_fundamental_unit = input_unit_object.fundamental_unit;
  
  // We show the same quantity in different units
  units_to_display = [];

  input_unit_object.output_quantity = input_quantity;

  unit_list.forEach(function(output_unit) {
    // Skip the input unit
    if(output_unit == input_unit_object) {
      return;
    }

    // Check output unit has same fundamental unit
    if(output_unit.fundamental_unit == input_fundamental_unit) { 
      output_unit.output_quantity = input_fundamental_quantity / output_unit.fundamental_quantity;
      output_unit.output_quantity_string = output_number_format(output_unit.output_quantity);

      if(output_unit.output_quantity_string.length <= 4) {
        units_to_display.push(output_unit);
      }
    } else {
      output_unit.output_quantity = undefined;
    }
  });
  drawUnits(units_to_display);

  // We also show a comparison to help the user understand whether it is big or small
  comparisons_to_display = [];

  comparisons.forEach(function(c) {
    // Check the comparison has the same fundamental unit
    if(input_fundamental_unit == c.fundamental_unit) {
      c.output_fraction = input_fundamental_quantity / c.fundamental_quantity;
      c.output_fraction_string = comparison_number_format(c.output_fraction);

      if(c.output_fraction <= 1) {
        comparisons_to_display.push(c);
      }
    } else {
      c.output_fraction = undefined;
    }
  });

  drawComparisons(comparisons_to_display);
}


function drawUnits(data) {
  blocks = d3.select('#output').selectAll('div.unit').data(data, function(d) { return d.name; });

  new_blocks = blocks.enter().append('div')
    .attr('class', 'unit')

  new_blocks.append('h2');

  new_blocks.append('span')
    .attr('class','preciseValue')

  new_blocks.append('p')
    .attr('class','description')
    .html(function(d) { return d.description; });


  blocks.select('h2').html(function(d) { return ""+d.output_quantity_string+"&thinsp;"+d.symbol+" &mdash; "+d.name;});
  blocks.select('.preciseValue').html(function(d) { return ""+d.output_quantity+"&thinsp;"+d.symbol+" to be precise."; });

  blocks.exit().remove();


}

function drawComparisons(data) {
  blocks = d3.select('#comparisons').selectAll('div.comparison').data(data, function(d) { return d.name; });

  new_blocks = blocks.enter().append('div')
    .attr('class', 'comparison')

  new_blocks.append('h2');

  new_blocks.append('div').attr('class', 'outerbar').append('div').attr('class','innerbar')

  new_blocks.append('p')
    .attr('class','description')
    .html(function(d) { return d.description; });


  blocks.select('h2').html(function(d) { return d.output_fraction_string+" "+d.name;});
  blocks.select('div.innerbar').attr('style', function(d) { return 'width:'+Math.round(d.output_fraction*100,1)+"%"; });

  blocks.exit().remove();


}

function checkIfInputRecognised() {
  if(!resultsShown && inputForm.node().value.trim() != "") {
    d3.select('#examples').attr('style','display: none');
    d3.select('#apology').attr('style','display: block');
    ga('send', 'pageview', 'missing/'+window.location.hash.slice(1));
    resultsShown = true;
  }
}


function showResults() {
  resultsShown = true;
  d3.select('#examples').attr('style','display: none');
  d3.select('#apology').attr('style','display: none');
  d3.select('#results').attr('style','display: block');
}

function clear() {
  if(resultsShown) {
    drawUnits([]);
    drawComparisons([]);
    d3.select('#input_description .name').html("");
    d3.select('#input_description .description').html("");
    d3.select('#examples').attr('style','display: block');
    d3.select('#results').attr('style','display: none');
    d3.select('#apology').attr('style','display: none');
    window.location.hash = "";
    resultsShown = false;
  }
}


if(window.location.hash != "") {
  inputForm.node().value = decodeURIComponent(window.location.hash.slice(1));
}

d3.selectAll('a.example').on('click',function() {
  inputForm.node().value = this.innerHTML;
  d3.event.preventDefault()
  userInput(); // To trigger an update
});

