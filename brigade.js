const { Job, Group } = require("brigadier")
const devops = require("devops-brigade");

// TODO: The notifyInfoAsync method requires a Microsoft Teams webhook - see
// https://confluence-engineering.dentsuaegis.com/display/GD/Send+notifications+to+Teams+channel
// or comment them out until ready

class JobFactory {
  createBuildJob(e, project) {
    // TODO: If not "node", specify alternative docker container for your build
    var build = new Job("build", "node") 
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
      `zip ${project.secrets.app_name}.zip *`
      taskFactory.storeBuild()
    ]

    return build;
  }

  createDeployJob(teamEnv, e, project) {
    let deployTaskFactory = new devops.DeployTaskFactory(teamEnv, e, project)
    let deployJob = new Job(`deploy-${teamEnv}`, `globaldevopsreg11.azurecr.io/builder:latest`)
    deployJob.storage.enabled = true

    // TODO: Uncomment this section if we are gonna use kubernetes as our compute 
    // let values = {
    //   image: {
    //     tag: "${APP_VER}",
    //     repository: `${project.secrets.app_container_reg}/${devops.Utilities.getAppName()}`
    //   }
    // };

    deployJob.tasks = [
      // If doing a cluster type deployment then uncomment this
      // deployTaskFactory.loginToCluster(),
      deployTaskFactory.setAppVerEnv(),
      "cd /src/",
      `az functionapp deployment source config-zip  -g {project.secrets.azure_resource_group} -n ${project.secrets.app_name} --src ./${project.secrets.app_name}.zip`
      // deployTaskFactory.helmUpgradeInstallCommandWithValidation(
      //   `${teamEnv}`,
      //   `${teamEnv}-${project.secrets.app_name}`,
      //   `./helm/${project.secrets.app_name}`,
      //   values)
    ]

    return deployJob;
  }
}

// TODO: notification via teams on error - remove if not using teams
devops.Events.enableNotifyOnError();

devops.Events.onPushDevelop(async (e, project) => {
  let jobFactory = new JobFactory();
  await jobFactory.createBuildJob(e, project).run();
  // TODO: add SonarQube integration https://confluence-engineering.dentsuaegis.com/display/GD/Sonarqube
  await jobFactory.createDeployJob(`${project.secrets.team_name}-dev`, e, project).run();
  //var semver = await devops.Utilities.getSemVerAsync();
});

devops.Events.onPushOther(async (e, project) => {
  new JobFactory().createBuildJob(e, project).run();
});

devops.Events.onDeploy(async (e, project, teamEnv, version) => {
  await new JobFactory().createDeployJob(teamEnv, e, project).run();
  await devops.Utilities.notifyInfoAsync(`Deployment`, `Deployment to ${teamEnv} of ${version} initiated`);
});

exports.JobFactory = JobFactory