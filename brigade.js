const { Job, Group } = require("brigadier")
const devops = require("devops-brigade");

class JobFactory {
  createBuildJob(e, project) {
    var build = new Job("build", "node:10.16.3") 
    build.storage.enabled = true
    let taskFactory = new devops.BuildTaskFactory(e, project)
    build.tasks = [
      "cd /src",
      taskFactory.gitVersion(),
      taskFactory.npmVersion(),
      // Build
      "git config --global credential.helper 'store'",
      "rm -rf node_modules",
      "npm install",
      `zip ${project.secrets.app_name}.zip *`,
      taskFactory.storeBuild()
    ]
    return build;
  }
 

  createDeployJob(teamEnv, e, project) {
    let deployTaskFactory = new devops.DeployTaskFactory(teamEnv, e, project)
    let deployJob = new Job(`deploy-${teamEnv}`, `globaldevopsreg11.azurecr.io/builder:latest`)
    deployJob.storage.enabled = true

    deployJob.tasks = [
      deployTaskFactory.setAppVerEnv(),
      "cd /src/",
      `az functionapp deployment source config-zip  -g {project.secrets.azure_resource_group} -n ${project.secrets.app_name} --src ./${project.secrets.app_name}.zip`,
    ]
    return deployJob;
  }
}

devops.Events.onPushDevelop(async (e, project) => {
  let jobFactory = new JobFactory();
  await jobFactory.createBuildJob(e, project).run();
  await jobFactory.createDeployJob(`${project.secrets.team_name}-dev`, e, project).run();
  await devops.Utilities.notifyInfoAsync(`Deployment to test complete`, `Deployed version ${semver}`);
});

devops.Events.onPushOther(async (e, project) => {
  new JobFactory().createBuildJob(e, project).run();
});

devops.Events.onDeploy(async (e, project, teamEnv, version) => {
  await new JobFactory().createDeployJob(teamEnv, e, project).run();
  await devops.Utilities.notifyInfoAsync(`Deployment`, `Deployment to ${teamEnv} of ${version} initiated`);
});

exports.JobFactory = JobFactory
