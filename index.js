const express = require("express");
const bodyParser = require('body-parser');
const cors = require('cors');
const {
    WebhookClient
} = require('dialogflow-fulfillment');
const {
    Card,
    Suggestion
} = require('dialogflow-fulfillment');
const axios = require('axios');
const cheerio = require('cheerio');
const {
    BrowseCarouselItem,
    BrowseCarousel,
    Image
} = require('actions-on-google');
const trainingJSON = require('./courses.json');


let app = express()
app.use(cors({
    credentials: true,
    origin: true
}));

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
    extended: true
}));

const DEFAULT_WELCOME_INTENT = "Default Welcome Intent";
const INTERNSHIP_CALL = "Internship Call";
const ALL_TRAINING ="All Trainings";

function makeURL(url) {
    if(!url)
        return "https://internshala.com"

    if (!url.split('https://cdn.internshala.com/')[1])
        return "https://internshala.com" + url;
    else
        return url;
}

function allTrainings(agent){
    let conv = agent.conv();
    conv.ask(`Here are some relevant trainings that you may enroll into`);
    let result = [];
    
    Object.keys(trainingJSON).forEach(element=>{
            result.push(new BrowseCarouselItem({
                title: trainingJSON[element].title,
                footer: `Duration ${trainingJSON[element].duration}`,
                url: trainingJSON[element].trainingURL,
                description: trainingJSON[element].learnings.join('\n'),
                image: new Image({
                    url: trainingJSON[element].imgURL,
                    alt: trainingJSON[element].title,
                })
            }))
    })
  
    conv.ask(new BrowseCarousel({
        items: result
    }))
    agent.add(conv);    
}

function findInternship(url) {
    return new Promise(function (resolve, reject) {
        axios.get(url)
            .then((response) => {
                if (response.status === 200) {
                    const $ = cheerio.load(response.data);
                    let result = [];

                    $('.individual_internship').each(function (i, elem) {
                        if (i > 4)
                            return;

                        let tdItems = $(elem).find('td').text().split('\n')
                        result.push(new BrowseCarouselItem({
                            title: $(this).find('h4').text().trim().split('                \n')[0],
                            footer: `Apply by: ${tdItems[4]}`,
                            url: 'https://internshala.com' + $(this).find('a').attr('href'),
                            description: `The posting requires an intern who can start ${tdItems[0]} and is available for a duration of ${tdItems[2]}. The posting provides a stipend of ${tdItems[3]}`,
                            openUrlAction: {
                                url: 'https://internshala.com' + $(this).find('a').attr('href')
                            },
                            image: new Image({
                                url: makeURL($(this).find('img').attr('src')),
                                alt: $(this).find('h4').text().trim().split('                \n')[0],
                            })
                        }));
                    });
                    resolve(result)

                }
            }, (error) => console.log(error));
    })

}


function defaultWelcomeIntent(agent) {
    agent.add(`Hey!! Welcome to Internshala. Let's start with your journey of finding your dream internship now`);
    agent.add(new Card({
        title: `Internshala`,
        imageUrl: 'https://www.onlinemarketplaces.com/ext/resources/-1GOMS/Jobs/Misc/internshala.png?1543972245',
        text: `Internshala is a dot com business with the heart of dot org.✨✨`,
        buttonText: 'Visit Us',
        buttonUrl: 'https://internshala.com/'
    }));
    agent.add(`Here are some quick suggestions for you`);
    agent.add(new Suggestion(`Find internships in Delhi`));
    agent.add(new Suggestion(`List trainings`));
}

function internshipCall(agent) {

    let conv = agent.conv();
    console.log(agent.parameters['geo-city'])
    console.log(agent.parameters.Domains)

    if (agent.parameters['geo-city'] && agent.parameters.Domains) {
        return findInternship(`https://internshala.com/internships/${agent.parameters.Domains}-internship-in-${agent.parameters['geo-city']}`).then(res => {
        
            if(res){
                conv.ask(`Here are the latest ${agent.parameters.Domains}internships in ${agent.parameters['geo-city']}`);
                conv.ask(new BrowseCarousel({
                    items: res
                }));
            }else{
                conv.ask("Sorry, we could not find internships with the particular query");
            }
          
            agent.add(new Suggestion(`Find internships in Kolkata`));
            agent.add(new Suggestion(`View more`));
            agent.add(new Suggestion(`Show trainings`));
            agent.add(conv);
        });

    } else {
        if (agent.parameters['geo-city']) {
            return findInternship(`https://internshala.com/internships/internship-in-${agent.parameters['geo-city']}`).then(res => {
               
            if(res){
                conv.ask(`Here are the latest internships in ${agent.parameters['geo-city']}`);
                conv.ask(new BrowseCarousel({
                    items: res
                }));
            }else{
                conv.ask("Sorry, we could not find internships with the particular query");
            }
                agent.add(new Suggestion(`Find software internships`));
                agent.add(new Suggestion(`View more`));
                agent.add(new Suggestion(`Show relevant trainings`));
                agent.add(conv);
            });

        } else if (agent.parameters.Domains) {
            return findInternship(`https://internshala.com/internships/${agent.parameters.Domains}-internship`).then(res => {
                if(res){
                conv.ask(`Here are the latest internships in ${agent.parameters.Domains}`);
                conv.ask(new BrowseCarousel({
                    items: res
                }));
                }else{
                    conv.ask("Sorry, we could not find internships with the particular query");
                }
                agent.add(new Suggestion(`Find internships in Delhi`));
                agent.add(new Suggestion(`View more`));
                agent.add(new Suggestion(`Trainings`));
                agent.add(conv);
            });

        }
    }
}

app.post('/', (request, response) => {
    const agent = new WebhookClient({
        request,
        response
    });


    let intentMap = new Map();
    intentMap.set(DEFAULT_WELCOME_INTENT, defaultWelcomeIntent);
    intentMap.set(INTERNSHIP_CALL, internshipCall);
    intentMap.set(ALL_TRAINING, allTrainings);
    agent.handleRequest(intentMap);
})


app.listen(4001, (err) => {
    if (err)
        throw err
})
