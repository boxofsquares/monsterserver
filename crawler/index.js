const cheerio = require('cheerio');
require('request'); // co-dependency to request-promise-native
const request = require('request-promise-native');
const fs      = require('fs');
const path    = require('path');
'use strict';


const base = '.mon-stat-block';
// Wiki?
// request.get('https://en.wikipedia.org/wiki/List_of_Dungeons_%26_Dragons_5th_edition_monsters')
//   .then((res) => {
//     let $ = cheerio.load(res);
//     let allMonsters = $('#mw-content-text .wikitable')
//     .eq(3).find('tr td:nth-child(1)')
//     .map((i, elem) => {
//       return $(elem).text().trim().toLowerCase().replace(/\s/g,'-');
//     }).get();
//     return allMonsters;
//   }
console.log('Retrieving all monster names from dnd5eapi.co...');
request.get('http://dnd5eapi.co/api/monsters')
  .then((res) => {
    // console.log(res.results); 
    return JSON.parse(res).results.map((obj) => {
      return obj.name.toLowerCase().replace(/\s/g, '-').replace("'", '');
    })
  })
// donjon?
// request.get('https://donjon.bin.sh/5e/monsters')
//   .then((res) => {
//     let $               = cheerio.load(res),
//         allMonsterNames = $('#monster_list tr').data('name');
//         console.log(res);
//     allMonsterNames.map((i, elem) => {
//       return $(elem).text().trim().toLowerCase().replace(/\s/g,'-').replace("'", '');
//     }).get();
//   })
  .then((res) => {
    let options = {
      resolveWithFullResponse: true
    }
    let allPromises = [];
    console.log('Building requests...')
    allPromises = res.map((monsterName) => {
      return request
        .get(`https://www.dndbeyond.com/monsters/${monsterName}/more-info`, options)
        .catch((error) => {
          return { wikiName: monsterName, res: 'failure'};
        })
        .then((response) => {
          if (response.statusCode == 200) {
            return { wikiName: monsterName, res: response.body};
          } else  {
            return { wikiName: monsterName, res: 'failure'};
          }
        });
    });
    return Promise.all(allPromises);
  })
  .then((allResponses) => {
    console.log('Starting request processing...')
    let allMonsterObjs = allResponses
      .filter(({ wikiName, res}) => {
        $ = cheerio.load(res);
        return !(res === 'failure' || $(base).length < 1); 
      })
      .map(({ wikiName, res }, index) => {
      $ = cheerio.load(res);
      
      // Name
      let monsterObj = { index: index};
      monsterObj.name =  $(base + '__name').text().trim();
      
      // Size, race, alignment
      let sizeRaceAlignment = $(base + '__meta');
      monsterObj = { ...monsterObj, ...getSizeRaceAligment(sizeRaceAlignment)};

      // Attributes
      let attributes = $(base + '__attributes');
      monsterObj.attributes = getAttributes(attributes);

      // Abilities
      let abilities = $('.ability-block').children();
      let abilitiesObj = {};
      abilities.each((e, elem) => {
        abilitiesObj = { ...abilitiesObj, ...getAbilities($(elem)) };
      });
      monsterObj.abilities = abilitiesObj; 

      // Sills & Traits
      let traits = $(base + '__tidbits').children();
      let traitsObj = {};
      traits.each((i, elem) => {
          traitsObj = { ...traitsObj, ...getTraits($(elem))}
      });

      monsterObj.traits = traitsObj;

      // Other descriptions
      let desc = $(base + '__description-blocks').children();
      let descObj = {};

      desc.each((i,elem) => {
        descObj= { ...descObj, ...getDescFromElement($(elem))};
      });

      monsterObj.actions = descObj;
      
      // Flavor text
      let flavor = $('.mon-details__description-block-content').text().trim().replace(/\s{2,}/g, ' ');
      if (flavor !== '') {
        monsterObj.flavor = flavor;
      }

      return monsterObj;
    });


    fs.writeFileSync(path.resolve(__dirname, 'monsters.json'), JSON.stringify(allMonsterObjs, null, '\t'));
  })
  .then((none) => {
    console.log("All done! File written to " + __dirname);
  });

  function getSizeRaceAligment(element) {
    let metas = element.text(),
    flagString = metas.match(/\(.*\)/g),
    flag = flagString ? true : false,
    returnObj = {};
  
    if (flag) {
      metas = metas.replace(/\(.*\)\s*/g, '');
      returnObj['spec-type'] = flagString[0].replace(/[\(\)]/g, '');
    }
    let metaSplits= metas.split(','),
      sizeAndType = metaSplits[0].split(' '),
      alignment = metaSplits[1];

    returnObj.size = sizeAndType[0].toLowerCase().trim();
    returnObj.type = sizeAndType.slice(1).join(' ').trim();
    returnObj.alignment = alignment.trim();

    return returnObj;
  }
  function getAbilities(element) {
    let key = element.children().eq(0).text().toLowerCase().replace(/[\s\n]/g, '-');
    let stat = getScoreAndMod(element.children().eq(1));
    return { [key]: stat };
  }
  function getScoreAndMod(elem) {
    let children = elem.children();
    return { score: parseInt(children.eq(0).text()), modifier: parseInt(sanitizeValue(children.eq(1).text()))}
  }

  function getAttributes(element) {
    let children      = element.children(),
        armorNode     = children.eq(0),
        hitPointsNode = children.eq(1),
        speedNode     = children.eq(2),
        attributesObj;

    attributesObj = {
      [sanitizeKey(armorNode.children().eq(0).text())]     : getArmorClass(armorNode.children().eq(1)),
      [sanitizeKey(hitPointsNode.children().eq(0).text())] : getHitPoints(hitPointsNode.children().eq(1)),
      [sanitizeKey(speedNode.children().eq(0).text())]     : getSpeeds(speedNode.children().eq(1)),
    }

    return attributesObj;
  }

  function getArmorClass(element) {
    let children = element.children();
    return { score: parseInt(children.eq(0).text()), type: sanitizeValue(children.eq(1).text())}
  }

  function getHitPoints(element) {
    let children = element.children();
    return { total: parseInt(children.eq(0).text()), ['hit-die'] : sanitizeValue(children.eq(1).text())}
  }

  function getSpeeds(element) {
    return sanitizeValue(element.children().eq(0).text());
  }
  
  function getTraits(element) {
    let key = sanitizeKey(element.children().eq(0).text());
    let stat = sanitizeValue(element.children().eq(1).text());
    return { [key]: stat };
  }

  function getDescFromElement(element) {
    let hasDescName = element.children().first().hasClass(element.attr('class') + '-heading');
    let descKey = hasDescName  ?  sanitizeKey(element.children().first().text()) : 'passive';
    let descObj = { [descKey] : [] };
    element.children().last().children().each((i, el) => {
      let key, value;
      if ($(el).contents().length > 1 ) {
        key = $(el).contents().first().text().replace(/[\n\.]/g,'');
        $(el).contents().first().remove();
      } else {
        key = 'General';
      }
      value = $(el).text().trim().replace(/[\n]/g, '');
      descObj[descKey].push({ name: key, description: value, ...parseDetails(value) })
    });
    return descObj;
  }

  function sanitizeKey(keyString) {
    return keyString.toLowerCase().replace(/[\s\n]/g, '-')
  }

  function sanitizeValue(valueString) {
    return valueString.trim().replace(/[\(\)]/g,'');
  }

  const attackBonusReg = /\+\d{1,2}/g;
  const damageReg = /\(\s*\d{1,2}d\d{1,2}\s*(\+?\s*\d{1,2}\s*)\)/g; 
  const reachReg = /\d{1,3}\s*ft\./g;

  function parseDetails(description) {
    let attackBonus = description.match(attackBonusReg);
    let hitDetails = description.match(damageReg);
    let reach = description.match(reachReg);

    let detailsObj = {};
    if (attackBonus) {
      attackBonus = attackBonus[0].replace(/\+/g,'');
      detailsObj['attack-bonus'] = parseInt(attackBonus.replace(/\+/,''));
    }
    if (hitDetails) {
      let [ hitDie, hitBonus ] = hitDetails[0].split('+');
      detailsObj['damage-die'] = hitDie.replace(/[\(\)\s]/g,'');
      detailsObj['damage-bonus'] = parseInt(hitBonus ? hitBonus.replace(/[\(\)\s]/g,'') : '0');
    }

    if (reach) {
      detailsObj['reach'] = parseInt(reach[0].replace(/[^0-9]/g, ''));
    }
    
    return detailsObj;    
  }
  
