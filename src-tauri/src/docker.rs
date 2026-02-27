use bollard::Docker;
use bollard::container::ListContainersOptions;
use bollard::image::ListImagesOptions;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub state: String,
}

#[derive(Serialize, Deserialize, Default)]
pub struct ImageInfo {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: i64,
    pub created: i64,
}

#[tauri::command]
pub async fn docker_list_containers() -> Result<Vec<ContainerInfo>, String> {
    let docker = Docker::connect_with_local_defaults().map_err(|e| e.to_string())?;
    let options = Some(ListContainersOptions::<String> {
        all: true,
        ..Default::default()
    });

    let containers = docker.list_containers(options).await.map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for c in containers {
        result.push(ContainerInfo {
            id: c.id.unwrap_or_default(),
            name: c.names.unwrap_or_default().join(", "),
            image: c.image.unwrap_or_default(),
            status: c.status.unwrap_or_default(),
            state: c.state.unwrap_or_default(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn docker_list_images() -> Result<Vec<ImageInfo>, String> {
    let docker = Docker::connect_with_local_defaults().map_err(|e| e.to_string())?;
    let options = Some(ListImagesOptions::<String> {
        all: true,
        ..Default::default()
    });

    let images = docker.list_images(options).await.map_err(|e| e.to_string())?;
    
    let mut result = Vec::new();
    for img in images {
        result.push(ImageInfo {
            id: img.id,
            repository: img.repo_tags.get(0).map(|s| s.split(':').next().unwrap_or("unknown")).unwrap_or("unknown").to_string(),
            tag: img.repo_tags.get(0).map(|s| s.split(':').last().unwrap_or("latest")).unwrap_or("latest").to_string(),
            size: img.size,
            created: img.created,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn docker_container_action(id: String, action: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults().map_err(|e| e.to_string())?;
    
    match action.as_str() {
        "start" => docker.start_container::<String>(&id, None).await.map_err(|e| e.to_string())?,
        "stop" => docker.stop_container(&id, None).await.map_err(|e| e.to_string())?,
        "restart" => docker.restart_container(&id, None).await.map_err(|e| e.to_string())?,
        "remove" => docker.remove_container(&id, None).await.map_err(|e| e.to_string())?,
        _ => return Err("Invalid action".to_string()),
    }

    Ok(())
}

#[tauri::command]
pub async fn docker_remove_image(id: String) -> Result<(), String> {
    let docker = Docker::connect_with_local_defaults().map_err(|e| e.to_string())?;
    docker.remove_image(&id, None, None).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn docker_compose_action(path: String, action: String) -> Result<String, String> {
    use std::process::Command;
    
    let args = match action.as_str() {
        "up" => vec!["compose", "up", "-d"],
        "down" => vec!["compose", "down"],
        "restart" => vec!["compose", "restart"],
        _ => return Err("Invalid compose action".to_string()),
    };

    let output = Command::new("docker")
        .args(&args)
        .current_dir(std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new(".")))
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
