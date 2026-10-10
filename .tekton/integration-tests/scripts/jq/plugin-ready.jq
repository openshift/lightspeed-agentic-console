.status.observedGeneration >= .metadata.generation
and .spec.replicas > 0
and .status.updatedReplicas == .spec.replicas
and .status.replicas == .spec.replicas
and .status.readyReplicas == .spec.replicas
and .status.availableReplicas == .spec.replicas
and any(.spec.template.spec.containers[]; .image == $image)
