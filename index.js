const puppeteer = require('puppeteer')
const fs = require('fs/promises')

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
rl.question('Zadejte výraz, který chcete vyhledat na Alze: ', function (input) {
        console.log(`Hledám výsledky pro ${input}... `);
        const fce = (searchVyraz) => {
            start(searchVyraz)
            rl.close()
        }
        fce(input)

    })

async function start (searchVyraz) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()   
        
    let hledanýVýraz = searchVyraz
        
    //Go to Alza.cz
    await page.goto("https://www.alza.cz/")
    //Type in ""
    await page.type("#edtSearch", searchVyraz)
    //Click search btn
    await page.click('#btnSearch')
    //Let the webpage load
    await page.waitForTimeout(2000)
    // Celkový počet výsledků
    const celkovýPočetVýsledků = await page.$eval("#lblNumberItem", a => a.textContent)
    // For loop kolikrát
    let početCyklů = 25
    celkovýPočetVýsledků < početCyklů ? početCyklů = celkovýPočetVýsledků + 1 : ""
 

    async function dataProduktu(x, i) {
        x['Kód produktu'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.bottom > div.codec span.code`, a => a.textContent)
        x['Název produktu'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.top > div.fb > a`, a => a.textContent)
        x['URL obrázku'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.top img`, a => a.srcset.split(',')[0])
        // x['URL obrázku2'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.top img`, a => a["id"])
        // x['URL obrázku3'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.top img`, a => a["data-srcset"])
        // x['URL obrázku2'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.top img`, a => a['data-src'].split(',')[0])
        // x['URL obrázku'] = await page.evaluate(`#boxes > div:nth-child(${i}) > div.top img`, a => toString( a.srcset.split(',')[0]) )
        x['Cena s DPH'] = await page.$eval(`#boxes > div:nth-child(${i}) > div.bottom > div.price > div.priceInner > span.c2`, a => a.textContent)

    }
    async function dataProduktuRating(x, i) {
        if ((await page.$(`#boxes > div:nth-child(${i}) > div.top div.stars-element`)) !== null) {
            x['Hodnocení v %'] = await page.evaluate(el => el.style.width, await page.$(`#boxes > div:nth-child(${i}) > div.top div.stars-element`))
        } else {
            x['Hodnocení v %'] = await 'Žádné recenze'
        }
        return x['Hodnocení v %']
    }
    async function switchSkladem(xy) {
        switch ( true ) {
            case xy.match(/Skladem >/g) == "Skladem >" : xy = `> ${xy.match(/[0-9]/g).join('')} ks` 
            break 
            case xy.match(/Skladem/g) == "Skladem" : xy = `${xy.match(/[0-9]/g)} ks`
            break
            case xy.match(/Rozbaleno skladem/g) == "Rozbaleno skladem" : xy = "1ks - rozbaleno"
            break
            case xy.match(/Zánovní skladem/g) == "Zánovní skladem" : xy = "1ks - zánovní"
            break
            case xy.match(/Použité skladem/g) == "Použité skladem" : xy = "1ks - použité"
            break
            case xy.match(/Očekáváme/g) == "Očekáváme" : xy = "0ks - nové jsou na cestě"
            break
            case xy.match(/Na objednávku/g) == "Na objednávku" : xy = "0ks - pouze na objednávku"
            break
            default : xy = "Data nenalezena"
    }
        return xy
}
    async function dataProduktuKsSkladem(x, i) {
        if ((await page.$(`#boxes > div:nth-child(${i}) > div.bottom div.postfix`)) !== null) {
            x['Kusů skladem'] = await page.evaluate(el => el.textContent, await page.$(`#boxes > div:nth-child(${i}) > div.bottom div.postfix`))
            x['Kusů skladem'] = await switchSkladem(x['Kusů skladem'])
        } else if (((await page.$(`#boxes > div:nth-child(${i}) > div.bottom div.avl span`)) !== null)) {
            x['Kusů skladem'] = await page.evaluate(el => el.textContent, await page.$(`#boxes > div:nth-child(${i}) > div.bottom div.avl span`))
            x['Kusů skladem'] = await switchSkladem(x['Kusů skladem'])
        } else {
            x['Kusů skladem'] = await '0 ks'
        }  
    }
        
        let myArray = new Array()
        async function forloopdata(nej) {
            for (let i = 1; i < početCyklů; i++) {
                let object = new Object()
                object['Pořadí'] = await `${i}. ${nej}`
                object.data = await dataProduktu(object, i)
                object.data2 = await dataProduktuRating(object, i)
                object.data3 = await dataProduktuKsSkladem(object, i)
                await delete object.data 
                await delete object.data2 
                await delete object.data3 
                
                await myArray.push(object)
                // await page.waitForTimeout(500)

            }
        }
            
        // VYSLEDEK LOG
        await fs.writeFile("result.txt", "Apify scraper pomocí Puppeteer\n")
        await fs.appendFile('result.txt', `Hledaný výraz: ${hledanýVýraz} \nCelkový počet výsledků: ${celkovýPočetVýsledků}`)
        
        // await page.click('#tabs > ul > li:nth-child(2)')
        const linkOdNejprodavanejsiho = await page.$x('//a[contains(text(), "Nejprodávanější")]')
        if (linkOdNejprodavanejsiho[0] == undefined) {
            await fs.appendFile('result.txt', "\n\n!!! Řazení od nejprodávanějšího na stránce neexistuje")
        } else {
            await linkOdNejprodavanejsiho[0].click()
            await page.waitForTimeout(2000)
            await fs.appendFile('result.txt', "\n\n24 nejprodávanějších produktů\n")
            await forloopdata("nejprodávanější")
            await fs.appendFile('result.txt', JSON.stringify(myArray, null, 1))
            myArray = []
        }

        // await page.click('#tabs > ul > li:nth-child(3)')
        const linkOdNejdrazsiho = await page.$x('//a[contains(text(), "Od nejdražšího")]')
        if (linkOdNejdrazsiho[0] == undefined) {
            await fs.appendFile('result.txt', "\n\n!!! Řazení od nejdražšího na stránce neexistuje")
        } else {
            await linkOdNejdrazsiho[0].click()
            await page.waitForTimeout(2000)
            await fs.appendFile('result.txt', "\n\n24 nejdražších produktů\n")
            await forloopdata("nejdražší")
            await fs.appendFile('result.txt', JSON.stringify(myArray, null, 1))
            myArray = []
        }

        // await page.click('#tabs > ul > li:nth-child(5)')
        const linkDleHodnocení = await page.$x('//a[contains(text(), "Dle hodnocení")]')
        if (linkDleHodnocení[0] == undefined) {
            await fs.appendFile('result.txt', "\n\n!!! Řazení dle hodnocení na stránce neexistuje")
        } else {
            await linkDleHodnocení[0].click()
            await page.waitForTimeout(2000)
            await fs.appendFile('result.txt', "\n\n24 nejlépe hodnocených produktů\n")
            await forloopdata("nejlépe hodnocený")
            await fs.appendFile('result.txt', JSON.stringify(myArray, null, 1))
            myArray = []
        }


    await console.log(`Výsledek hledání je uložen v soubotu result.txt`)
    await browser.close()
}

// start()

// await fs.writeFile("text.txt", BaseInfo)
// do konzole node index.js abych to spustil a pak CtrlC to stop

//F12 > Copy selector = query path

// await page.screenshot({ path: "sssss.png" }) --- screenshot

// const text = "text"
// await fs.writeFile("text.txt", text)

// return Array.from(document.querySelectorAll("#lblNumberItem")).map(a => a.textContent + "\n")

// return Array.from(document.querySelectorAll("#lblNumberItem")).map(a => a.textContent)
