# Persistência no Firebase

O painel usa Firebase Authentication com login Google e Cloud Firestore.
Cada conta acessa somente os próprios dados no caminho `users/{uid}`.

## Configuração

1. Crie um projeto no Firebase no plano Spark.
2. Ative o provedor Google em **Authentication > Sign-in method**.
3. Crie um banco Cloud Firestore no modo de produção.
4. Registre uma aplicação Web e copie a configuração para `firebase-config.js`.
5. Adicione `lgmeyer.github.io` aos domínios autorizados do Authentication.
6. Publique as regras de `firestore.rules`.

```bash
firebase login
firebase use <project-id>
firebase deploy --only firestore:rules
```

## Estrutura

```text
users/{uid}/entries/{entryId}
users/{uid}/categoryOptions/{categoryId}
users/{uid}/viabilityScenarios/{scenarioId}
```

As regras negam acesso a qualquer documento fora do espaço do usuário autenticado.
