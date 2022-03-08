import * as d3 from "https://cdn.skypack.dev/d3@7";

let units = new Map(); // This contains the correct spellings of units
let rough_units = new Map(); // This contains approximate spellings of units
let unit_regular_expression = /\s*(\d+(\.\d+)?([eE]-?\d+)?)\s*(.*)/;
let alias_split_regular_expression = /\s*,\s*/;
let small_comparison_number_format = d3.format(".0%");
let large_comparison_number_format = d3.format(".1f");

let user_input_text = undefined;

let response = await fetch("units.tsv");

if (!response.ok) {
    throw Error(`Could not load units.tsv: ${response.status} ${response.statusText}`);
}

let unit_list = d3.tsvParse(await response.text());

// First pass sorts out the individual units
unit_list.forEach(function(d) {
    // Turn equivalent_to into a quantity and unit
    let match = unit_regular_expression.exec(d.equivalent_to);
    d.equivalent_quantity = +match[1];
    d.equivalent_unit = match[4].toLowerCase().trim();

    // Clean up other attributes
    d.name = d.name.trim();
    d.symbol = d.symbol.trim();

    if (d.symbol == "") {
        d.symbol = d.name;
    }

    // Clean up variants
    if (d.exclude_from_results == undefined) { d.exclude_from_results = ""; }
    d.exclude_from_results = d.exclude_from_results.trim().toLowerCase();
    if (d.exclude_from_results == "yes" || d.exclude_from_results == "y" || d.exclude_from_results == 'true') {
        d.exclude_from_results = true;
    } else {
        d.exclude_from_results = false;
    }

    // File it in this type according to its symbol, name and aliases
    if (d.symbol.length > 0) {
        units.set(d.symbol.toLowerCase(), d);
    };
    if (d.name.length > 0) {
        units.set(d.name.toLowerCase(), d);
    }

    rough_units.set(roughMatch(d.symbol), d);
    rough_units.set(roughMatch(d.name), d);

    let aliases = d.aliases.split(alias_split_regular_expression);

    aliases.forEach(function(a) {
        a = a.toLowerCase().trim();
        if (a.length > 0) {
            units.set(a, d);
            rough_units.set(roughMatch(a), d);
        };
    });
});

// Then we try and put each unit into the fundamental unit for that type
unit_list.forEach(convertToFunamentalUnit);

let units_response = await fetch("units.tsv");

if (!units_response.ok) {
    throw Error(`Could not load units.tsv: ${units_response.status} ${units_response.statusText}`);
}

let comparisons = d3.tsvParse(await units_response.text());


comparisons.forEach(function(d) {
    let match = unit_regular_expression.exec(d.equivalent_to);
    d.equivalent_quantity = +match[1];
    d.equivalent_unit = match[4].toLowerCase().trim();

    d.name = d.name.trim();
});

// Can only change conversions into fundamental unit when units
// have been loaded
comparisons.forEach(convertToFunamentalUnit);

// For ease of display, put the largest comparisons and units at the top
comparisons.sort(fundamental_unit_comparison);
unit_list.sort(fundamental_unit_comparison);


let inputForm = d3.select('input#input');
inputForm.on('input', userInput);

let resultsShown = false;

let input_timeout = undefined;

// Call this once, in case the inputs were set from the hash before
// all the data was loaded 
userInput();

function fundamental_unit_comparison(a, b) {
    // If they are different units, leave them alone
    if (a.fundamental_unit != b.fundamental_unit) {
        return 0;
    } else {
        return b.fundamental_quantity - a.fundamental_quantity;
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
    if (unit.fundamental_type == undefined) {
        unit.fundamental_quantity = unit.equivalent_quantity;
        unit.fundamental_unit = unit.equivalent_unit;
    }
    let fundamental_unit = units.get(unit.fundamental_unit);
    while (fundamental_unit != undefined) {
        unit.fundamental_quantity = unit.fundamental_quantity * fundamental_unit.equivalent_quantity;
        unit.fundamental_unit = fundamental_unit.equivalent_unit;
        let next_fundamental_unit = units.get(unit.fundamental_unit);
        if (fundamental_unit == next_fundamental_unit) {
            break;
        } else {
            fundamental_unit = next_fundamental_unit;
        }
    }
}

// We don't display numbers in any more significant figures than the input
function significantFigures(number_as_string) {
    match = /\s*(0.0*)?(\d+(\.\d+)?)/.exec(number_as_string);
    significant_digits = match[2].replace('.', '');
    return significant_digits.length
}

// We use a thin sapce to separate thousands and numbers from unit
function format(number, unit, number_of_significant_figures) {
    return d3.format(",." + number_of_significant_figures + "r")(number).replace(/,/gi, '&thinsp;') + "&thinsp;" + unit;
}


// This tries to come up with an approximate match for a unit, so that
// additional spaces, repeated letters, hypthens and pluralised words don't matter.
// e.g., KILO-watts per   hours becomes kilowatperhour
function roughMatch(string) {
    let lower_and_trimmed = string.toLowerCase().trim()
    let no_repeats = lower_and_trimmed.replace(/(.)(?=\1+)/gi, "$1");
    let no_junk = no_repeats.replace(/(s\b)|\W/gi, "");
    return no_junk;
}


function userInput() {
    // Get what the user wrote
    let text = inputForm.property("value");

    // Check if changed
    if (text == user_input_text) {
        return;
    }
    user_input_text = text;

    // Make it appear in the page title
    document.title = "How much is " + text + "?";

    // Split it into quantitiy and unit
    let match = unit_regular_expression.exec(text);
    if (match == undefined) { return clear(); }

    let input_quantity = +match[1];

    let input_unit_original_case = match[4].trim();
    let input_unit = input_unit_original_case.toLowerCase().trim();

    let input_significant_figures = significantFigures(match[1]);

    // The user may not have entered a unit yet
    if (input_unit.length == 0) { return clear(); }

    input_unit_object = units.get(input_unit);
    if (input_unit_object == undefined) {
        input_unit_object = rough_units.get(roughMatch(input_unit));
    }

    // This waits for 5 seconds in case the user is typing
    // if, after 5 seconds, the unit isn't recognised, shows
    // an apology to the user
    clearTimeout(input_timeout);
    input_timeout = setTimeout(checkIfInputRecognised, 5 * 1000);

    // The unit may not be recognised
    if (input_unit_object == undefined) { return clear(); }

    showResults();
    window.location.hash = encodeURIComponent(text);

    // Show the unit to the user in various titles
    if (input_unit != input_unit_object.name.toLowerCase()) {
        interpretation_text = input_unit_original_case + " is probably " + input_unit_object.name + " (" + input_unit_object.symbol + ")";
    } else {
        interpretation_text = input_unit_object.name;
    }

    d3.select('#input_description .name').text(interpretation_text);
    d3.select('#input_description .description').html(input_unit_object.description);

    d3.select('#comparisons .title').html(format(input_quantity, input_unit_object.symbol, input_significant_figures) + " is approximately:");
    d3.select('#output .title').html("To " + input_significant_figures + " significant figures, " + format(input_quantity, input_unit_object.symbol, input_significant_figures) + " is equivalent to:");

    // Convert the user input into the fundamental unit
    input_fundamental_quantity = input_quantity * input_unit_object.fundamental_quantity;
    input_fundamental_unit = input_unit_object.fundamental_unit;

    // We show the same quantity in different units
    units_to_display = [];

    input_unit_object.output_quantity = input_quantity;


    unit_list.forEach(function(output_unit) {
        // Skip the input unit
        if (output_unit == input_unit_object) {
            return;
        }

        // Check output unit has same fundamental unit
        if (output_unit.fundamental_unit == input_fundamental_unit) {
            if (!output_unit.exclude_from_results) {
                output_unit.output_quantity = input_fundamental_quantity / output_unit.fundamental_quantity;
                output_unit.output_quantity_string = format(output_unit.output_quantity, output_unit.symbol, input_significant_figures);
                // We might want to see this one
                units_to_display.push(output_unit);
            }
        } else {
            output_unit.output_quantity = undefined;
        }
    });

    // We don't want to overload the user, so select a subset of the possible
    // units to display, prefering those with the shortest number (i.e., 10 beats 0.1 and 100)
    units_to_display.sort(function(a, b) {
        return a.output_quantity_string.length - b.output_quantity_string.length;
    });

    // And slice it to show at most 5 results, and sort it small to large
    units_to_display = units_to_display.slice(0, 5);
    units_to_display.sort(fundamental_unit_comparison); // Fundamental unit sort will be the same as quantitiy sort

    drawUnits(units_to_display.slice(0, 5));

    // We also show a comparison to help the user understand whether it is big or small
    comparisons_to_display = [];

    comparisons.forEach(function(c) {
        // Check the comparison has the same fundamental unit
        if (input_fundamental_unit == c.fundamental_unit) {
            c.output_fraction = input_fundamental_quantity / c.fundamental_quantity;
            if (c.output_fraction < 1.3) {
                c.output_fraction_string = small_comparison_number_format(c.output_fraction) + " of " + c.name;
            } else {
                c.output_fraction_string = large_comparison_number_format(c.output_fraction) + " &times; " + c.name;
            }
            if (c.output_fraction < 10) {
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
        .attr('class', 'preciseValue')

    new_blocks.append('p')
        .attr('class', 'description')
        .html(function(d) { return d.description; });

    blocks.select('h2').html(function(d) { return "" + d.output_quantity_string + " &mdash; " + d.name; });

    blocks.exit().remove();


}

function drawComparisons(data) {
    comparison_divs = d3.select('#comparisons').selectAll('div.comparison').data(data, function(d) { return d.name; });

    // Add overall structure for new comparisons
    new_divs = comparison_divs.enter().append('div')
        .attr('class', 'comparison')

    new_divs.append('h2');

    new_divs.append('div').attr('class', 'barwrapper');

    new_divs.append('p')
        .attr('class', 'description')
        .html(function(d) { return d.description; });

    // Remove obsolete comparisons
    comparison_divs.exit().remove();

    // Update comparisons
    comparison_divs.select('h2').html(function(d) { return d.output_fraction_string; });

    blocks = comparison_divs.select('div.barwrapper').selectAll('div.outerbar')
        .data(function(d) { return proportionToBlockWidths(d.output_fraction); });

    blocks.enter().append('div').attr('class', 'outerbar').append('div').attr('class', 'innerbar');
    blocks.exit().remove();

    blocks.attr('style', function(d) { return d.outer });
    blocks.select('div.innerbar').attr('style', function(d) { return d.inner });

}

function proportionToBlockWidths(proportion) {
    div = Math.floor(proportion);
    remainder = proportion % 1;
    // This alternative is to make blocks smaller so they fit in one line
    //number_of_blocks = Math.ceil(proportion);
    //outer_width = Math.round(100/number_of_blocks)-1;
    //outer_style = "width: "+outer_width+"%";
    outer_style = "width: 100%";
    result = [];
    for (i = 0; i < div; i++) {
        result[i] = { outer: outer_style, inner: 'width: 100%' };
    }
    if (remainder != 0) {
        result.push({ outer: outer_style, inner: "width: " + Math.round(remainder * 100) + "%" });
    }
    return result;
}

function checkIfInputRecognised() {
    if (!resultsShown && inputForm.node().value.trim() != "") {
        d3.select('#examples').classed('closed', false);
        d3.select('#apology').classed('closed', false);
        resultsShown = true;
    }
}

function showResults() {
    resultsShown = true;
    d3.select('#examples').classed('closed', true);
    d3.select('#apology').classed('closed', true);
    d3.select('#input_description').classed('closed', false);
    d3.select('#comparisons').classed('closed', false);
    d3.select('#output').classed('closed', false);
}

function clear() {
    if (resultsShown) {
        drawUnits([]);
        drawComparisons([]);
        d3.select('#input_description .name').html("");
        d3.select('#input_description .description').html("");
        d3.select('#examples').classed('closed', false);
        d3.select('#input_description').classed('closed', true);
        d3.select('#comparisons').classed('closed', true);
        d3.select('#output').classed('closed', true);
        window.location.hash = "";
        resultsShown = false;
    }
}

function updateInputFromHash() {
    document.getElementById("input").value = decodeURIComponent(window.location.hash.slice(1));
}


if (window.location.hash != "") {
    updateInputFromHash();
}


window.addEventListener('hashchange', updateInputFromHash);