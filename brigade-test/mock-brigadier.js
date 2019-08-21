var mock = require('mock-require'); 

const mockBrigadier = { 
    events: {
        on: function(name, f) {}
    },
    Job: function(name, container) {
      return {
          storage: {
              enabled:false
          },
          name: name,
          container: container
      }  
    },
};

// For devops-brigade-worker < 0.0.82
mock('brigadier', mockBrigadier);
mock('./dist/brigadier', mockBrigadier);
mock('../../../../dist/brigadier', mockBrigadier);

exports.logJob = function logJob(job, name) {
    console.log('-------------------------')
    console.log(name || job.name)
    console.log('-------------------------')
    console.log(job);
    console.log()
    console.log("TASKS:")
    
    for (var i in job.tasks)
    {
        console.log(job.tasks[i])
        if (job.tasks[i].includes("${project.secrets")) {
            throw "Bad substitution, are you missing back-ticks for this task?"
        }
    }

    console.log()
}
