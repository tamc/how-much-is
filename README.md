how-much-is
===========

I wrote this tool to help me understand numbers in different units. The purpose of the tool is to be practical. Therefore it is content to deal in units and conversions that are ambiguous (e.g., $100/barrel) or not strictly correct (e.g., ppm which could be &micro;kg/kg or &micro;m3/m3).

Canonical source: http://github.com/tamc/how-much-is

License: &copy; 2014 tom@counsell.org - [Open source MIT licence](./LICENSE).

Warnings:

* Take care: I take no responsiblity for the consequences of errors in this software.
* Take care: This tool reflects my preference, and so the conversion outputs have the same significant figures as the inputs. Therefore don't naively use this as a source of conversion factors. Look in [Units.tsv](./Units.tsv) for that, or better yet, go to an authoritative source.
* Take care: This tool uses the number precision of the underlying javascript environment. So, errors can creep in. If you feel like converting the code to use a bigdecimal arithmetic library, that would be brilliant.


Adding or editing units
=======================

Edit [units.tsv](units.tsv) to add a new unit. It is easiest to edit this file in a spreadsheet program. Once edited, either email the new copy to me at tom@counsell.org or, if you know how, use github to [fork and pull](https://help.github.com/articles/using-pull-requests).

The file has one row per unit. By unit we mean suffix that might be added to a number. So kilograms and grams get separate rows.

Each row has:

* name - the conventional name of the unit, in plural form, capitalised correctly (e.g., seconds)
* symbol - the conventional symbol for that unit, captialised correctly (e.g., s)
* aliases - other, possibly incorrect, ways the unit is referred to (e.g, sec for second). Separate alternatives with a comma (e.g., second, sec, secs). No need to worry about the various ways the name might be capitalised, hyphenated or spaced. Do include plurals unless they are simply the addition of an s at the end of a word.
* equivalent_to - the unit in another unit (e.g., for a minute, we put 60s). A few more details on this are below.
* description - start with the singular name in bold, then what it is, then who uses it and for what.
* source - a reputable source for the conversion. The [NIST](http://physics.nist.gov/Pubs/SP811/appenB9.html) is a good source. Wikipedia less so.

The equivalent_to column can contain a number and unit written in any other unit. If that unit appears elsewhere in the table, then it is assumed tha a number in this unit can be converted into that other unit _and_ any unit that the other unit can be converted into. So, for example, if we have:

<table>
  <tr><td>name</td><td>equivalent_to</td></tr>
  <tr><td>gram</td><td>1 gram</td></tr>
  <tr><td>kilogram</td><td>1000 gram</td></tr>
  <tr><td>pound</td><td>0.4536 kilogram</td></tr>
  <tr><td>blob</td><td>12 slugs</td></tr>
  <tr><td>meter</td><td>1 meter</td></tr>
  <tr><td>kilometer</td><td>1000 meters</td></tr>
</table>

Then a kilogram can be converted to a gram. A pound can also be converted to a gram, because pound has been given a unit in kilograms, and kilograms has been given a unit in grams. However, the system can't convert a blog into a kilogram, despite the blog being a recognised unit of mass. This is because it can convert a blog into a slug, but there is no definition of slug and, in particular, there is no definition of slug that refers to either a gram or a kilogram or a pound. This is the same reason the system won't convert a kilometer into a gram.



