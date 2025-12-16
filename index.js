import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

import bcrypt from "bcryptjs";
import { DateTime } from "luxon";

const saltRounds = 12;

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Test",
    password: "minirabih",
    port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let student_id;
let selected_courses = [];
let selected_subjects = [];
let all_courses = [];
let all_subjects = [];
let output = [];
let users = [];
let supervisors = [];
let chosenSections = [];
let duration = [];
let access = false;
let supervisor = false;

app.get("/", async(req, res) => {
    res.render("welcome.ejs", {access: access});
});

app.get("/welcome", async(req, res) => {
    res.render("welcome.ejs", {access: access});
});

app.get("/aboutus", (req, res) => {
    res.render("aboutus.ejs");
})

app.get("/contactus", async (req, res) => {
    if(access){
        const email = await db.query(
            `SELECT 1 FROM student_profile WHERE student_id = $1`,
            [student_id]
        );
        res.render("contactus.ejs", {email: email});
    } else {
        res.render("loginrequired.ejs");
    }
})

app.post("/contactus", async (req, res) => {
    let query = `INSERT INTO inbox (read, student_id, message, name) VALUES ($1, $2, $3, $4)`;
        const name = await db.query(`SELECT CONCAT(first_name, ' ', last_name) FROM student_profile WHERE student_id = $1;`, [student_id]);
        const message = req.body.message;
        await db.query(query, [false, student_id, message, name.rows[0].concat]);
        res.render("contactus.ejs", {message: "Your message was received successfully"});
})

app.get("/signup", (req, res) => {
    res.render("signup.ejs");
})

app.post("/signup", async (req, res) =>{ 
    const email = req.body.email;
    let exists = await checkExistence(email);
    if(exists){
        res.status(409).render("signup.ejs", {
            error: "Email already exists, please use a different one or <a href='/login'>Login</a> to your account!"
        });
    } else {
        let firstName = req.body.firstName;
        let lastName = req.body.lastName;
        let password = req.body.password;
        try{
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            let query = "INSERT INTO student_profile (first_name, last_name, email, password, supervisor) " +
            "VALUES ($1, $2, $3, $4, $5);";
            await db.query(query, [firstName, lastName, email, hashedPassword, false]);
            selected_courses.length = 0;
            let query2 = "SELECT student_id FROM student_profile WHERE email = $1"
            const result = await db.query(query2, [email]);
            student_id = result.rows[0].student_id;
            console.log(student_id);
            access = true;
            res.render("features.ejs", {supervisor: supervisor});     
        } catch (err) {
            console.error("Error registering new user: ", err);
            res.render("error.ejs", {
                message: "Error has occured"
            }); 
        }
    }
})

app.get("/login", (req, res) => {
    res.render("login.ejs");
})

app.post("/login", async(req, res) => { 
    const email = req.body.email;
    const validEmail = await checkExistence(email);
    const password = req.body.password;

    if(validEmail == false){
        res.render("login.ejs", {
            error: "Email not found, please use a different one or <a href='/signup'>create a new account</a>",
        });
    } else {
        let query = "SELECT * FROM student_profile WHERE email = $1;";
        try {
            const result = await db.query(query, [email]);
            const hashedPassword = result.rows[0].password;
            const match = await bcrypt.compare(password, hashedPassword);

            if(match) {
                access = true;
                student_id = result.rows[0].student_id;
                supervisor = result.rows[0].supervisor;
                console.log(student_id);
                console.log(supervisor);
                res.render("features.ejs", {supervisor: supervisor});
            } else {
                res.status(401).render("login.ejs", {
                    error: "Wrong password, please try again.</a>",
                });
            } 

        } catch (err) {
            console.error("Internal error has occurred: ", err);
            res.status(500).render("error.ejs", {
                message: "Server Error has occurred",
            });
        }
    }
});

app.post("/course", async(req, res) => {
    selected_subjects = req.body.sel_subj;

    console.log(selected_subjects);
    try {
        all_courses = await db.query(
          "SELECT * FROM courses WHERE subject = ANY($1::text[]) ORDER BY subject;",
          [selected_subjects]
        );
        res.render("courses.ejs", {courses: all_courses.rows});
      } catch (err) {
        console.log(err);
      }  
});

app.get("/course", async(req, res) => {
    if(req.query.SUB_BTN == "Add"){
        let course_id = req.query.sel_courses;
        if(selected_courses.includes(course_id)){
            res.render("courses.ejs", {courses: all_courses.rows, message: `This course was already selected.`});
        } else {
            selected_courses.push(course_id);
            selected_courses.sort();
            console.log(selected_courses);
            res.render("courses.ejs", {courses: all_courses.rows});
        }
    } else {
        all_subjects = await db.query(
            "SELECT * FROM subjects;"
        );
        res.render("subjects.ejs", {subjects: all_subjects.rows});
    }
});

app.post("/confirm", async(req, res) => {
    let name_of_courses = await getNameOfCourses(selected_courses);
    let campuses_of_courses = await findCampuses(selected_courses);
    res.render("confirm.ejs", {selected_courses: selected_courses, campus: campuses_of_courses, names: name_of_courses});
})

app.get("/delete", async (req, res) => {
    const idx = req.query.value;
    selected_courses.splice(idx, 1);
    let names = await getNameOfCourses(selected_courses);
    let campus = await findCampuses(selected_courses);
    if(selected_courses.length === 0){
        res.render("confirm.ejs", {selected_courses: selected_courses, campus: campus, names: names, error: 'No Selected Courses'});
    } else {
        res.render("confirm.ejs", {selected_courses: selected_courses, campus: campus, names: names});
    }
})

app.post("/save", async(req, res) => {
    let selected_schedule =  output[req.body.value];
    let name = req.body.name;
    let history = await db.query(
        `SELECT * FROM history WHERE student_id = $1`,
        [student_id]
    );

    if(history.rows.length === 10){
        res.render("schedules.ejs", {schedules: output, duration: duration, error: `You reached your limit for saved schedules. Please delete old schedules in order to save the new ones.`});
    } else {
        try{
            await db.query(
                `INSERT INTO history (student_id, schedule_name, schedule)
                VALUES ($1, $2, $3);`, 
                [student_id, name, selected_schedule]
            );
            res.render("schedules.ejs", {schedules: output, duration: duration});
        } catch (err) {
            if (err.code === '23505') { // Unique violation
                if (err.constraint === 'unique_student_schedule') {
                    res.render("schedules.ejs", {
                      schedules: output,
                      duration: duration,
                      error: `This schedule already exists. Try modifying it or saving another one.`,
                    });
                } else if (err.constraint === 'unique_student_schedule_name') {
                    res.render("schedules.ejs", {
                      schedules: output,
                      duration: duration,
                      error: `You already have a schedule with the name "${name}". Please choose a different name.`,
                    });
                }
            } else {
              throw err; // or handle other errors
            }
        }
    }
})

app.get("/history", async(req, res) => {
    if(access){
        let result = await db.query(
            `SELECT * FROM history WHERE student_id = $1;`, 
            [student_id]
        );
    
        if(result.rows.length == 0){
            let message = `No records found.`;
            res.render("history.ejs", {history: result.rows, message: message});
        }
        res.render("history.ejs", {history: result.rows});
    } else {
        res.render("loginrequired.ejs");
    }
})

app.get("/remove", async(req, res) => {
    let name = req.query.name;
    await db.query(
        `DELETE FROM history WHERE student_id = $1 AND schedule_name = $2;`,
        [student_id, name]
    )

    let result = await db.query(
        `SELECT * FROM history WHERE student_id = $1;`, 
        [student_id]
    );

    if(result.rows.length == 0){
        let message = `No records were found.`;
        return res.render("history.ejs", {history: result.rows, message: message});
    }
    res.render("history.ejs", {history: result.rows});
})

app.get("/features", async(req, res) => {
    if(access){
        res.render("features.ejs", {supervisor: supervisor});
    } else {
        res.render("loginrequired.ejs");
    }
})

app.post("/subjects", async(req,res)=>{
    all_subjects = await db.query(
        "SELECT * FROM subjects;"
    );
    res.render("subjects.ejs", {subjects: all_subjects.rows});
})

app.get("/view", async(req, res) => {
    let name = req.query.name;
    let result = await db.query(
        `SELECT * FROM history WHERE student_id = $1 AND schedule_name = $2`,
        [student_id, name]
    );

    let schedulesAsString = result.rows[0].schedule;
    let schedule = schedulesAsString.split(" ").map(Number);

    chosenSections.length = 0;
    for(var i = 0; i < schedule.length; i++){
        chosenSections.push(await getInfo(schedule[i]));
    }

    res.render("view.ejs", {chosenSections});
})

app.post("/findSched", async(req, res) => {
    let values = [];
    let findSched = true;

    for(let i = 0; i < selected_courses.length; i++){
        const c = req.body[`campus_${i}`];
        if(!c || c.length === 0){
            findSched = false;
        }
        values.push(c? c.map(Number): []);
    }

    if(findSched && selected_courses.length > 1){
        values.unshift(student_id);
        let query = generateQuery(selected_courses.length);

        try {
            selected_courses.sort((a, b) => a - b);
            await db.query(
            `INSERT INTO student_course_selections (student_id, course_selection)
            VALUES ($1, $2)
            ON CONFLICT (student_id)
            DO UPDATE SET course_selection = EXCLUDED.course_selection;`, 
            [student_id, selected_courses]);

            
            const hashedScheduleId = await createIdentifier(selected_courses);

            let q = await db.query(
                "SELECT * FROM valid_schedules WHERE schedule_id = $1",
                [hashedScheduleId]
            );

            if(q.rows[0] == null){
                output = [];
            } else {
                output = q.rows[0].schedules;
            }
                //finds the valid schedules and store them in an array
                let result = await db.query(
                    generateQuery(selected_courses.length)
                    , values
                );
                let valid_schedules = result.rows;
                
                duration = [];
                for(var i = 0; i < valid_schedules.length; i++){
                    let min = Number.MAX_SAFE_INTEGER;
                    let max = Number.MIN_SAFE_INTEGER;
                    
                    let crns = Object.values(valid_schedules[i]);
                    for(var j = 0; j <crns.length; j++){
                        let section = await getInfo(crns[j]);
                        
                        // Convert times to minutes
                        let startTimeInMinutes = timeToMinutes(section.startingTime);
                        let endTimeInMinutes = timeToMinutes(section.endingTime);
                        
                        // Compare the start and end times (in minutes)
                        min = Math.min(min, startTimeInMinutes);
                        max = Math.max(max, endTimeInMinutes);
                    }
                    duration.push({
                        min: `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`,
                        max: `${String(Math.floor(max / 60)).padStart(2, '0')}:${String(max % 60).padStart(2, '0')}`
                    });
                }

                //convert each schedule into a string and store them in an array
                let string;
                for(let i = 0; i < valid_schedules.length; i++){
                    string = '';
                    for(let key of Object.keys(valid_schedules[i])){
                        string += valid_schedules[i][key] + ' ';
                    }
                    string = string.slice(0, -1);
                    output.push(string);
                }

                await db.query(
                    `INSERT INTO valid_schedules (schedule_id, schedules)
                    VALUES ($1, $2)`, [hashedScheduleId, output]
                )
        
            res.render("schedules.ejs", {schedules: output, duration: duration});   
        } catch (err) {
            console.log(err);
        }
    } else {
        let name_of_courses = await getNameOfCourses(selected_courses);
        let campuses_of_courses = await findCampuses(selected_courses);
        if(selected_courses.length <= 1){
            res.render("confirm.ejs", {selected_courses: selected_courses, campus: campuses_of_courses, names: name_of_courses, message:`Please select at least two courses.`});
        } else {
            res.render("confirm.ejs", {selected_courses: selected_courses, campus: campuses_of_courses, names: name_of_courses, message:`There was at least a course with an undertermined campus. Make sure to select at least one campus per course.`});
        }
    }
});

app.get("/viewsupervisors", async(req,res) => {
    if(req.query.SUB_BTN == "Make Supervisor"){
        console.log(req.query);
        await db.query(`
            UPDATE student_profile SET supervisor = true WHERE student_id = $1;`, [req.query.selected_supervisor]
        );
    } 

    supervisors = await db.query(
        `SELECT student_id, first_name, last_name FROM student_profile WHERE supervisor;`
    );

    res.render("viewsupervisor.ejs", {sups: supervisors.rows});        
})

app.post("/viewsupervisors", async(req, res) => {
    if(req.body.SUB_BTN == "Remove Supervisor"){
        await db.query(`
            UPDATE student_profile SET supervisor = false WHERE student_id = $1;`, [parseInt(req.body.selected_supervisor)]
        );
        supervisors = await db.query(
            `SELECT student_id,first_name, last_name FROM student_profile WHERE supervisor;`
        );
        res.render("viewsupervisor.ejs", {sups: supervisors.rows, message: `Supervisor removed.`});
    } else {
        users = await db.query(
            `SELECT student_id,first_name, last_name FROM student_profile WHERE NOT supervisor;`
        );
        res.render("setsupervisor.ejs", {users: users.rows});
    }
})

app.post("/changeterms", async(req,res) => {
    await db.query(
        `ALTER TABLE sections RENAME TO fall_2025;
        CREATE TABLE sections (
            crn INT PRIMARY KEY,
            section_number VARCHAR,
            campus INT,
            course_id INT,
            days VARCHAR,
            start_time TIME WITHOUT TIME ZONE,
            end_time TIME WITHOUT TIME ZONE,
            instructor text,
            location text
        ); 
        COPY sections FROM 'C:/Program Files/PostgreSQL/15/data/data_project/sections.csv' DELIMITER ',' CSV HEADER;
        `
    );
    res.render("features.ejs", {supervisor: supervisor, message: `Term Updated.`});
})

app.post("/update", (req,res) => {
    //generate the csv files and choose only the one of the sections
    console.log(`update`);
})

app.get("/inbox", async (req, res) => {
    let inbox = await db.query(`SELECT * FROM inbox`);
    res.render("inbox.ejs", {inbox: inbox.rows});
})

app.post("/markasread", async(req, res) => {
    console.log(req.body);
    let id = req.body.name;
    let readStatus = req.body.read === 'true';
    
    try {
        await db.query('UPDATE inbox SET read = $1 WHERE message_id = $2', [readStatus, id]);
        res.redirect('/inbox');
    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).send('Internal Server Error');
    }
})

/*
******************************************************************************
----------------- EVERYTHING BELOW THIS LINE IS FUNCTIONS -------------------
******************************************************************************
*/

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function generateQuery(numberOfCourses) {
    var str =
    "WITH student_sections AS (\n" +
    "                SELECT * \n" +
    "                FROM Sections \n" +
    "                WHERE course_id = ANY(SELECT UNNEST(course_selection) FROM student_course_selections WHERE student_id = $1)\n" +
    "            ),\n" +
    "generate_schedules AS (\n" +
    "            SELECT\n";

    for (let i = 1; i <= numberOfCourses; i++) {
        if(i == numberOfCourses){
            str += "s" + i + ".crn AS section" + i + "\n";
        } else {
            str += "s" + i + ".crn AS section" + i + ",\n";
        }
        
    }
    str += "FROM student_sections s1\n";

    if (numberOfCourses > 1) {
        for (let i = 2; i <= numberOfCourses; i++) {
            str += "JOIN student_sections s" + i + "\n";
            str += "ON s" + (i - 1) + ".course_id < s" + i + ".course_id\n";
            for (let j = 1; j < i; j++) {
                str += "AND check_overlap(s" + j + ".crn, s" + i + ".crn)\n";
            }
        }
    }

    for (let i = 1; i <= numberOfCourses; i++) {
        str += "AND s" + i + ".campus = ANY($" + (i+1) + ")\n";
    }

    str += ")\n" + "SELECT ";

    for (let i = 1; i <= numberOfCourses; i++) {
        if (i == 1) {
            str += "section1";
        } else {
            str += ", section" + i;
        }
    }
    str += "\n" + "FROM generate_schedules;";
    return str;
}

async function getNameOfCourses(selected_courses){
    var selected_courses_name = [];
    for(let i = 0; i < selected_courses.length; i++){
        let result = await db.query(
            `SELECT * FROM courses WHERE course_id = $1`,
            [selected_courses[i]]
        );
        let course_info = result.rows[0];
        let string = '' + course_info.subject + course_info.course_number + ' - ' + course_info.course_name;
        selected_courses_name.push(string);
    }
    return selected_courses_name;
}

async function findCampuses(selected_courses) {
    let result = await db.query(`
        SELECT 
            course_id,
            ARRAY_AGG(DISTINCT campus) AS campuses
        FROM Sections
        WHERE course_id = ANY($1)
        GROUP BY course_id;`, [selected_courses]
    );

    const campusMap = {};
    result.rows.forEach(row => {
        campusMap[row.course_id] = row.campuses;
    });

    const completeResult = selected_courses.map(courseId => {
        return {
            course_id: courseId,
            campuses: campusMap[courseId] ?? [0]
        };
    });

    return completeResult;
}

async function checkExistence(email){ 
    let query = `SELECT EXISTS (SELECT 1 FROM student_profile WHERE email = $1)`;
    try{
        const res = await db.query(query, [email]);
        return res.rows[0].exists;
    } catch (err){
        console.error("Database error :", err);
        return false;
    }
}

async function getInfo(crn){
        const res = await db.query("SELECT * FROM sections WHERE crn = $1", [crn]);
        let course = res.rows[0];
        // console.log(course);

        let section = course.section;
        let campus = (course.campus == 1)?"Beirut":"Byblos";
        let days = course.days;

        let startingTime = course.start_time;
        let endingTime = course.end_time;
        startingTime = DateTime.fromFormat(startingTime, "HH:mm:ss");
        endingTime = DateTime.fromFormat(endingTime, "HH:mm:ss");
        let duration = endingTime.diff(startingTime, 'minutes').minutes;
        startingTime = startingTime.toFormat("HH:mm");
        endingTime = endingTime.toFormat("HH:mm");

        let instructor = course.instructor;
        let location = course.location;
        let building = parseInt(location.slice(0, location.indexOf(" ")));
        let roomNumber = parseInt(location.slice(location.indexOf(" ") + 1));

        switch (building) {
            case 101:
                building = "Sage Hall";
                break;
            case 103:
                building = "Nicol Hall";
                break;
            case 107:
                building = "Irwin Hall";
                break;
            case 108:
                building = "Shannon Hall";
                break;
            case 106:
                building = "University Services";
                break;
            case 109:
                building = "Orme-Gray";
                break;
            case 104:
                building = "Safadi Fine Arts";
                break;
            case 105:
                building = "Joseph G. Jabbra Gymnasium";
                break;
            case 102:
                building = "Wadad Sabbagh Khoury Student Center";
                break;
            case 110:
                building = "Adnan Kassar School Of Business";
                break;
            case 111:
                building = "Riyad Nassar Library";
                break;
            case 112:
                building = "Beirut Underground Parking";
                break;
            case 113:
                building = "Gezairi Building";
                break;
            case 156:
                building = "Executive Center at Beirut Central District";
                break;
            case 158:
                building = "Santona Residence";
                break;
            case 160:
                building = "Sarraf Building";
                break;
            case 201:
                building = "Science Building";
                break;
            case 202:
                building = "Tohme-Rizk Building";
                break;
            case 233:
                building = "Cafeteria";
                break;
            case 203:
                building = "Architecture Hall";
                break;
            case 204:
                building = "Zakhem Hall";
                break;
            case 205:
                building = "Bassil Hall";
                break;
            case 235:
                building = "Block C";
                break;
            case 234:
                building = "Student Center";
                break;
            case 230:
                building = "Block A";
                break;
            case 231:
                building = "Block B";
                break;
            case 211:
                building = "Service Center";
                break;
            case 206:
                building = "Frem Building";
                break;
            case 246:
                building = "Animal Facility";
                break;
            case 237:
                building = "LAU Health Clinic";
                break;
            case 207:
                building = "Med";
                break;
            case 210:
                building = "Byblos Underground Parking";
                break;
            case 215:
                building = "Engineering Laboratories and Research Center";
                break;
            case 212:
                building = "Joseph G. Jabbra Library";
                break;
            case 213:
                building = "Riyad Nassar Central Administration";
                break;
            default:
                building = "New Building";
                break;
        }

        location = building + " " + roomNumber;

        let response = await db.query("SELECT * FROM courses WHERE course_id = $1;", [course.course_id]);
        
        let subject = response.rows[0].subject;
        let course_number = response.rows[0].course_number;
        let coursename = response.rows[0].course_name;

        subject = subject + " " + course_number;

    return {subject, coursename, section, startingTime, endingTime, duration, days, location, instructor};
}

//In order to use the function below, we must create tables that store the unique identifier for each combination
//and stores the created schedules.
async function createIdentifier(courses){ // New function that takes an array, sort its elements, and creates a unique identifier (hash).
    courses.sort((a,b) => a.localeCompare(b));
    var key = courses.join("");

    const hashedKey = await bcrypt.hash(key, 1);
    return hashedKey;
}

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});