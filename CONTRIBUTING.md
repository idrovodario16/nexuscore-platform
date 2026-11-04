# Contribuir

Abre una rama por cambio, usa commits convencionales (feat:, fix:, docs:) y explica comportamiento y validación en la PR. Ejecuta pruebas y compilación antes de proponer cambios. Mantén dominio separado de transporte y persistencia; usa tipos explícitos, nombres legibles, validación en el límite y consultas parametrizadas. No agregues abstracciones sin necesidad, datos reales, claves o dependencias del otro producto para iniciar este repositorio.

Los cambios de contratos deben actualizar JSON Schema, OpenAPI, fixtures y pruebas en ambos productos y en nexus-architecture. Un cambio incompatible requiere un nuevo tipo/v2 y una migración documentada. No modifiques silenciosamente v1.
